-- Migration patch: split fn_verify_audit_chain into two functions
-- Talitha Psicologia
--
-- Problem: F1 patch added `IF v_uid IS NULL` to fn_verify_audit_chain,
-- which correctly blocks anon but also blocks service_role (no auth.uid()).
-- The GRANT to service_role contradicts the internal check.
--
-- Decision: separate function for anchor verification (option B).
--
-- fn_verify_audit_chain — psychologist only, interactive inspection.
--   Returns broken_at_id for human diagnosis. Unchanged from F1 patch.
--
-- fn_anchor_audit_chain — service_role only, automated health check.
--   Returns is_valid + anchor payload (count, last hash, last timestamp).
--   Minimal surface: no broken_at_id, no per-entry iteration exposed.
--   This is what the ADR-0004 Layer 4 anchor cron calls.
--
-- Justification for separate function over allowing service_role in
-- the existing one:
--   1. Least privilege: cron needs pass/fail + anchor data, not per-entry
--      diagnostic UUIDs
--   2. Surface area: fn_verify_audit_chain iterates all rows and exposes
--      broken_at_id — narrower return type for the automated path is safer
--   3. Separation of concerns: interactive investigation (psychologist)
--      vs automated health check (cron)

-- ============================================================
-- Fix grant: remove service_role from fn_verify_audit_chain
-- (the internal check blocks it anyway — grant was contradictory)
-- ============================================================
REVOKE EXECUTE ON FUNCTION fn_verify_audit_chain FROM service_role;

-- ============================================================
-- fn_anchor_audit_chain: automated chain verification for cron
-- Returns the anchor payload: is_valid, entry count, last hash,
-- last timestamp. This is what the anchor-audit-log Edge Function
-- exports to email/bucket as tamper-evidence (ADR-0004 Layer 4).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_anchor_audit_chain()
RETURNS TABLE (
  is_valid         BOOLEAN,
  total_entries    BIGINT,
  last_row_hash    TEXT,          -- hex-encoded for export
  last_occurred_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_expected_hash BYTEA;
  v_prev BYTEA;
  v_total BIGINT := 0;
  v_valid BIGINT := 0;
  v_last_hash BYTEA;
  v_last_ts TIMESTAMPTZ;
  canonical TEXT;
BEGIN
  -- No auth.uid() check: this function is for service_role (cron).
  -- Access controlled entirely by GRANT (service_role only).

  FOR rec IN
    SELECT a.*
    FROM audit_log a
    ORDER BY a.created_at ASC, a.id ASC
  LOOP
    v_total := v_total + 1;

    canonical := json_build_object(
      'id', rec.id, 'actor_id', rec.actor_id,
      'actor_source', rec.actor_source, 'patient_id', rec.patient_id,
      'action', rec.action, 'target_id', rec.target_id,
      'target_table', rec.target_table, 'ip', rec.ip,
      'user_agent', rec.user_agent, 'metadata', rec.metadata,
      'occurred_at', rec.occurred_at,
      'prev_hash', encode(COALESCE(rec.prev_hash, '\x00'::bytea), 'hex')
    )::TEXT;

    v_expected_hash := extensions.digest(canonical, 'sha256');

    IF rec.row_hash = v_expected_hash AND (rec.prev_hash IS NOT DISTINCT FROM v_prev) THEN
      v_valid := v_valid + 1;
    END IF;

    v_prev := rec.row_hash;
    v_last_hash := rec.row_hash;
    v_last_ts := rec.occurred_at;
  END LOOP;

  RETURN QUERY SELECT
    (v_total = v_valid),
    v_total,
    encode(v_last_hash, 'hex'),
    v_last_ts;
END;
$$;

-- Privilege: service_role only, not PUBLIC, not authenticated
REVOKE EXECUTE ON FUNCTION fn_anchor_audit_chain FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_anchor_audit_chain TO service_role;
