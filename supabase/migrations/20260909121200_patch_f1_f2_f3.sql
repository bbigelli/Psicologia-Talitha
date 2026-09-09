-- Migration patch: F1 (NULL-safety), F2 (REVOKE from PUBLIC), F3 (pgcrypto schema)
-- Talitha Psicologia
--
-- Context: QA tested against the live bank. 3 findings:
--   F1: fn_verify_audit_chain (and 4 other RPCs) have NULL-unsafe
--       role checks — NULL != 'x' → NULL → IF does not enter → bypass
--   F2: REVOKE EXECUTE FROM anon is inert because privilege comes from
--       PUBLIC inheritance. Must REVOKE FROM PUBLIC then GRANT explicitly.
--   F3: digest() / gen_random_bytes() unresolvable in SECURITY DEFINER
--       functions with search_path = public — Supabase puts pgcrypto in
--       schema 'extensions'. Must schema-qualify the calls.
--
-- Lesson learned (F2): in PostgreSQL, functions get EXECUTE granted to
-- PUBLIC by default at creation time. REVOKE ... FROM <role> does NOT
-- remove privilege inherited from PUBLIC. The fix is:
--   REVOKE EXECUTE ON FUNCTION f FROM PUBLIC;
--   GRANT EXECUTE ON FUNCTION f TO <allowed_roles>;

-- ============================================================
-- F3: Fix pgcrypto resolution in SECURITY DEFINER functions
-- Qualify digest() and gen_random_bytes() with 'extensions.' schema.
-- This is preferred over adding 'extensions' to search_path because
-- a wider search_path in SECURITY DEFINER reopens name resolution
-- hijacking — the exact attack that the fixed search_path prevents.
-- ============================================================

-- F3a: fn_audit_log_hash_chain — CRITICAL (audit trail stops without this)
CREATE OR REPLACE FUNCTION fn_audit_log_hash_chain()
RETURNS TRIGGER AS $$
DECLARE
  last_hash BYTEA;
  canonical TEXT;
BEGIN
  -- Serialize access to prevent hash chain forking under concurrency
  PERFORM pg_advisory_xact_lock(hashtext('audit_log_chain'));

  -- Get the last row_hash
  SELECT row_hash INTO last_hash
  FROM audit_log
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  NEW.prev_hash := last_hash;

  -- Canonical representation: deterministic JSON of key fields
  canonical := json_build_object(
    'id', NEW.id,
    'actor_id', NEW.actor_id,
    'actor_source', NEW.actor_source,
    'patient_id', NEW.patient_id,
    'action', NEW.action,
    'target_id', NEW.target_id,
    'target_table', NEW.target_table,
    'ip', NEW.ip,
    'user_agent', NEW.user_agent,
    'metadata', NEW.metadata,
    'occurred_at', NEW.occurred_at,
    'prev_hash', encode(COALESCE(NEW.prev_hash, '\x00'::bytea), 'hex')
  )::TEXT;

  NEW.row_hash := extensions.digest(canonical, 'sha256');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- F3b: fn_sessions_on_reschedule — gen_random_bytes schema-qualified
CREATE OR REPLACE FUNCTION fn_sessions_on_reschedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    NEW.room_name := 's_' || encode(extensions.gen_random_bytes(16), 'hex');
    NEW.waiting_since := NULL;
    NEW.admitted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- F1 + F3: Fix all RPCs — NULL-safe checks + schema-qualified pgcrypto
-- Every != replaced with IS DISTINCT FROM where the compared
-- value can be NULL. Explicit NULL gates added where needed.
-- ============================================================

-- F1a + A1: log_audit — add explicit v_role NULL gate
CREATE OR REPLACE FUNCTION log_audit(
  p_patient_id    UUID,
  p_action        TEXT,
  p_target_id     UUID DEFAULT NULL,
  p_target_table  TEXT DEFAULT NULL,
  p_ip            INET DEFAULT NULL,
  p_user_agent    TEXT DEFAULT NULL,
  p_metadata      JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_role     TEXT;
  v_log_id   UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'log_audit: auth.uid() is NULL';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_actor_id;
  -- F1: if profile not found, v_role is NULL — block explicitly
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'log_audit: no profile found for actor';
  END IF;

  IF v_role = 'patient' AND p_patient_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM patients WHERE id = p_patient_id AND user_id = v_actor_id
    ) THEN
      RAISE EXCEPTION 'log_audit: patient can only log actions on own record';
    END IF;
  ELSIF v_role = 'psychologist' AND p_patient_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM patients WHERE id = p_patient_id AND psychologist_id = v_actor_id
    ) THEN
      RAISE EXCEPTION 'log_audit: psychologist can only log actions on own patients';
    END IF;
  END IF;

  INSERT INTO audit_log (
    actor_id, actor_source, patient_id, action,
    target_id, target_table, ip, user_agent, metadata
  ) VALUES (
    v_actor_id, 'user', p_patient_id, p_action,
    p_target_id, p_target_table, p_ip, p_user_agent, p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- F1b: log_audit_system — NULL-safe actor_source validation
CREATE OR REPLACE FUNCTION log_audit_system(
  p_actor_id      UUID,
  p_actor_source  TEXT,
  p_patient_id    UUID,
  p_action        TEXT,
  p_target_id     UUID DEFAULT NULL,
  p_target_table  TEXT DEFAULT NULL,
  p_ip            INET DEFAULT NULL,
  p_user_agent    TEXT DEFAULT NULL,
  p_metadata      JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- F1: NULL-safe validation
  IF p_actor_source IS NULL OR p_actor_source NOT IN ('edge_function', 'webhook', 'cron', 'anonymous') THEN
    RAISE EXCEPTION 'log_audit_system: invalid actor_source %', p_actor_source;
  END IF;

  IF p_actor_id IS NULL AND p_actor_source IS DISTINCT FROM 'anonymous' THEN
    RAISE EXCEPTION 'log_audit_system: actor_id required for source %', p_actor_source;
  END IF;

  INSERT INTO audit_log (
    actor_id, actor_source, patient_id, action,
    target_id, target_table, ip, user_agent, metadata
  ) VALUES (
    p_actor_id, p_actor_source, p_patient_id, p_action,
    p_target_id, p_target_table, p_ip, p_user_agent, p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- F1c: enter_waiting_room — NULL-safe patient_user_id comparison
CREATE OR REPLACE FUNCTION enter_waiting_room(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_session RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT s.id, s.patient_id, s.status, s.scheduled_at, s.duration_minutes,
         s.waiting_since, p.user_id AS patient_user_id
  INTO v_session
  FROM sessions s JOIN patients p ON p.id = s.patient_id
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  -- F1: NULL-safe — if patient has no user_id yet (uninvited), block
  IF v_session.patient_user_id IS NULL OR v_session.patient_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not your session';
  END IF;
  IF v_session.status NOT IN ('scheduled', 'confirmed') THEN
    RAISE EXCEPTION 'Session is not in a valid state for waiting room';
  END IF;
  IF now() < v_session.scheduled_at - interval '15 minutes' THEN
    RAISE EXCEPTION 'Too early to enter waiting room';
  END IF;
  IF now() > v_session.scheduled_at + (v_session.duration_minutes || ' minutes')::interval + interval '30 minutes' THEN
    RAISE EXCEPTION 'Session window has passed';
  END IF;

  UPDATE sessions SET waiting_since = now()
  WHERE id = p_session_id AND waiting_since IS NULL;
END;
$$;

-- F1d: admit_patient — NULL-safe role check
CREATE OR REPLACE FUNCTION admit_patient(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
  v_session RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  -- F1: IS DISTINCT FROM is null-safe; != is not
  IF v_role IS DISTINCT FROM 'psychologist' THEN
    RAISE EXCEPTION 'Only the psychologist can admit patients';
  END IF;

  SELECT id, psychologist_id, waiting_since, admitted_at
  INTO v_session FROM sessions WHERE id = p_session_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF v_session.psychologist_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not your session';
  END IF;
  IF v_session.waiting_since IS NULL THEN
    RAISE EXCEPTION 'Patient is not in the waiting room';
  END IF;
  IF v_session.admitted_at IS NOT NULL THEN RETURN; END IF;

  UPDATE sessions SET admitted_at = now() WHERE id = p_session_id;
END;
$$;

-- F1e: cancel_session — already safe (uses = with ELSE fallback),
-- but make the psychologist_id check null-safe for consistency
CREATE OR REPLACE FUNCTION cancel_session(
  p_session_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
  v_session RECORD;
  v_cancelled_by TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;

  SELECT s.id, s.patient_id, s.psychologist_id, s.status,
         s.scheduled_at, p.user_id AS patient_user_id
  INTO v_session
  FROM sessions s JOIN patients p ON p.id = s.patient_id
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;

  -- Structure is safe: both = checks fail on NULL, ELSE catches
  IF v_role = 'psychologist' AND v_session.psychologist_id IS NOT DISTINCT FROM v_uid THEN
    v_cancelled_by := 'psychologist';
  ELSIF v_role = 'patient' AND v_session.patient_user_id IS NOT DISTINCT FROM v_uid THEN
    v_cancelled_by := 'patient';
  ELSE
    RAISE EXCEPTION 'Not authorized to cancel this session';
  END IF;

  IF v_session.status NOT IN ('scheduled', 'confirmed') THEN
    RAISE EXCEPTION 'Session cannot be cancelled in status %', v_session.status;
  END IF;
  IF v_session.scheduled_at < now() - interval '30 minutes' THEN
    RAISE EXCEPTION 'Cannot cancel a session that has already passed';
  END IF;

  UPDATE sessions
  SET status = 'cancelled', cancelled_at = now(),
      cancelled_by = v_cancelled_by, cancellation_reason = p_reason,
      waiting_since = NULL, admitted_at = NULL
  WHERE id = p_session_id;
END;
$$;

-- F1f: consume_email_token — NULL-safe purpose comparison
CREATE OR REPLACE FUNCTION consume_email_token(
  p_token_hash       TEXT,
  p_expected_purpose TEXT,
  p_ip               INET DEFAULT NULL,
  p_user_agent       TEXT DEFAULT NULL
)
RETURNS TABLE (
  token_id    UUID,
  purpose     TEXT,
  patient_id  UUID,
  session_id  UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token RECORD;
BEGIN
  SELECT t.id, t.purpose, t.patient_id, t.session_id,
         t.expires_at, t.used_at
  INTO v_token
  FROM email_action_tokens t
  WHERE t.token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired token'; END IF;
  IF v_token.used_at IS NOT NULL THEN RAISE EXCEPTION 'Token already used'; END IF;
  IF v_token.expires_at < now() THEN RAISE EXCEPTION 'Token expired'; END IF;
  -- F1: IS DISTINCT FROM is null-safe
  IF v_token.purpose IS DISTINCT FROM p_expected_purpose THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  UPDATE email_action_tokens SET used_at = now() WHERE id = v_token.id;

  RETURN QUERY SELECT v_token.id, v_token.purpose,
                      v_token.patient_id, v_token.session_id;
END;
$$;

-- F1g + F3c: fn_verify_audit_chain — NULL-safe + schema-qualified digest
CREATE OR REPLACE FUNCTION fn_verify_audit_chain(
  p_from_id UUID DEFAULT NULL,
  p_to_id   UUID DEFAULT NULL
)
RETURNS TABLE (
  total_entries  BIGINT,
  valid_entries  BIGINT,
  broken_at_id   UUID,
  is_valid       BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
  rec RECORD;
  v_expected_hash BYTEA;
  v_prev BYTEA;
  v_total BIGINT := 0;
  v_valid BIGINT := 0;
  v_broken UUID := NULL;
  canonical TEXT;
BEGIN
  -- F1: NULL-safe auth check — IS DISTINCT FROM, not !=
  v_uid := auth.uid();
  SELECT p.role INTO v_role FROM profiles p WHERE p.id = v_uid;
  IF v_uid IS NULL OR v_role IS DISTINCT FROM 'psychologist' THEN
    RAISE EXCEPTION 'Only the psychologist can verify the audit chain';
  END IF;

  FOR rec IN
    SELECT a.*
    FROM audit_log a
    WHERE (p_from_id IS NULL OR a.created_at >= (SELECT created_at FROM audit_log WHERE id = p_from_id))
      AND (p_to_id IS NULL OR a.created_at <= (SELECT created_at FROM audit_log WHERE id = p_to_id))
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

    -- F3: schema-qualified digest
    v_expected_hash := extensions.digest(canonical, 'sha256');

    IF rec.row_hash = v_expected_hash AND (rec.prev_hash IS NOT DISTINCT FROM v_prev) THEN
      v_valid := v_valid + 1;
    ELSIF v_broken IS NULL THEN
      v_broken := rec.id;
    END IF;
    v_prev := rec.row_hash;
  END LOOP;

  RETURN QUERY SELECT v_total, v_valid, v_broken, (v_total = v_valid);
END;
$$;

-- ============================================================
-- F2: Fix REVOKE from PUBLIC, then GRANT to allowed roles
--
-- Lesson: in PostgreSQL, functions receive EXECUTE granted to
-- PUBLIC by default at creation. REVOKE ... FROM <role> does NOT
-- remove privilege inherited from PUBLIC — it only removes a
-- direct grant to that role, which may not exist. The effective
-- privilege of anon (or any role) comes from PUBLIC inheritance.
--
-- Fix: REVOKE FROM PUBLIC (removes the base), then GRANT explicitly
-- to the roles that should have access.
-- ============================================================

-- RPCs callable by authenticated users only
REVOKE EXECUTE ON FUNCTION log_audit FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_audit TO authenticated;

REVOKE EXECUTE ON FUNCTION enter_waiting_room FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enter_waiting_room TO authenticated;

REVOKE EXECUTE ON FUNCTION admit_patient FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admit_patient TO authenticated;

REVOKE EXECUTE ON FUNCTION cancel_session FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_session TO authenticated;

REVOKE EXECUTE ON FUNCTION fn_verify_audit_chain FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_verify_audit_chain TO authenticated;

-- consume_email_token: callable by PUBLIC (used by unauthenticated
-- email link actions via Server Action with withPublicAction wrapper).
-- The function validates the token hash, not the caller's session.
-- Keeping it callable by authenticated + service_role, NOT anon directly
-- (the Server Action runs as service_role).
REVOKE EXECUTE ON FUNCTION consume_email_token FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_email_token TO authenticated, service_role;

-- log_audit_system: callable by service_role only
REVOKE EXECUTE ON FUNCTION log_audit_system FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_audit_system TO service_role;

-- fn_verify_audit_chain also needs service_role for anchor cron
GRANT EXECUTE ON FUNCTION fn_verify_audit_chain TO service_role;
