-- Migration patch: F4 fix + canonical grant pattern for all functions
-- Talitha Psicologia
--
-- F4: fn_anchor_audit_chain executable by anon despite REVOKE FROM PUBLIC.
--
-- Root cause — two independent sources of EXECUTE in Supabase:
--   Source 1: PUBLIC (PostgreSQL default at CREATE FUNCTION)
--   Source 2: direct grants to anon/authenticated (Supabase ALTER DEFAULT PRIVILEGES)
-- Revoking from one does NOT touch the other.
--
-- The 7 original RPCs ended up protected by accident of sequence:
--   migration 121000 (B1): REVOKE FROM anon  → removed source 2
--   migration 121200 (F2): REVOKE FROM PUBLIC → removed source 1
-- fn_anchor_audit_chain (created in 121300) only got REVOKE FROM PUBLIC,
-- leaving the direct grant (source 2) intact.
--
-- Canonical pattern going forward (also added to CLAUDE.md):
--   REVOKE EXECUTE ON FUNCTION f FROM PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION f TO <allowed_roles>;
-- All three revocations are necessary, not redundant.

-- ============================================================
-- F4 fix: revoke both remaining sources from fn_anchor_audit_chain
-- ============================================================
REVOKE EXECUTE ON FUNCTION fn_anchor_audit_chain FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_anchor_audit_chain TO service_role;

-- ============================================================
-- Normalize: apply canonical pattern to all 8 RPC functions
-- to make the state explicit and not depend on migration order.
-- Idempotent — re-revoking an already-revoked privilege is a no-op.
-- ============================================================

-- log_audit: authenticated only
REVOKE EXECUTE ON FUNCTION log_audit FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION log_audit TO authenticated;

-- log_audit_system: service_role only
REVOKE EXECUTE ON FUNCTION log_audit_system FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION log_audit_system TO service_role;

-- enter_waiting_room: authenticated only
REVOKE EXECUTE ON FUNCTION enter_waiting_room FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION enter_waiting_room TO authenticated;

-- admit_patient: authenticated only
REVOKE EXECUTE ON FUNCTION admit_patient FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admit_patient TO authenticated;

-- cancel_session: authenticated only
REVOKE EXECUTE ON FUNCTION cancel_session FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_session TO authenticated;

-- consume_email_token: authenticated + service_role
REVOKE EXECUTE ON FUNCTION consume_email_token FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_email_token TO authenticated, service_role;

-- fn_verify_audit_chain: authenticated only
REVOKE EXECUTE ON FUNCTION fn_verify_audit_chain FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_verify_audit_chain TO authenticated;

-- fn_anchor_audit_chain: service_role only (already done above, idempotent)
-- (included in the block above for completeness)
