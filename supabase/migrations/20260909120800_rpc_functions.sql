-- Migration: RPC functions (SECURITY DEFINER)
-- Talitha Psicologia
--
-- Every SECURITY DEFINER function:
-- 1. Has fixed search_path
-- 2. Validates auth.uid()
-- 3. Validates role
-- 4. Validates ownership
-- 5. Writes ONLY the column(s) it is supposed to

-- ============================================================
-- log_audit: audit log entry from authenticated user context
-- (Requirement 4 - derives actor_id from auth.uid(), RAISE if NULL)
-- ============================================================
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
  v_log_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'log_audit: auth.uid() is NULL - cannot identify actor';
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

-- ============================================================
-- log_audit_system: audit log entry from service_role/edge context
-- (Requirement 24 - executable ONLY by service_role)
-- ============================================================
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
  -- Validate actor_source
  IF p_actor_source NOT IN ('edge_function', 'webhook', 'cron', 'anonymous') THEN
    RAISE EXCEPTION 'log_audit_system: invalid actor_source %', p_actor_source;
  END IF;

  -- actor_id required unless anonymous
  IF p_actor_id IS NULL AND p_actor_source != 'anonymous' THEN
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

-- ============================================================
-- enter_waiting_room: patient marks presence
-- (Requirement 6 - writes ONLY waiting_since)
-- ============================================================
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load session and validate ownership
  SELECT s.id, s.patient_id, s.status, s.scheduled_at, s.duration_minutes,
         s.waiting_since, p.user_id AS patient_user_id
  INTO v_session
  FROM sessions s
  JOIN patients p ON p.id = s.patient_id
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Validate ownership
  IF v_session.patient_user_id != v_uid THEN
    RAISE EXCEPTION 'Not your session';
  END IF;

  -- Validate status
  IF v_session.status NOT IN ('scheduled', 'confirmed') THEN
    RAISE EXCEPTION 'Session is not in a valid state for waiting room';
  END IF;

  -- Validate temporal window: 15 min before to end + 30 min
  IF now() < v_session.scheduled_at - interval '15 minutes' THEN
    RAISE EXCEPTION 'Too early to enter waiting room';
  END IF;
  IF now() > v_session.scheduled_at + (v_session.duration_minutes || ' minutes')::interval + interval '30 minutes' THEN
    RAISE EXCEPTION 'Session window has passed';
  END IF;

  -- Write ONLY waiting_since
  UPDATE sessions
  SET waiting_since = now()
  WHERE id = p_session_id
    AND waiting_since IS NULL;  -- idempotent
END;
$$;

-- ============================================================
-- admit_patient: psychologist admits patient from waiting room
-- (Requirement 6 - writes ONLY admitted_at, requires psychologist)
-- ============================================================
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify psychologist role in the database (never from JWT)
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role != 'psychologist' THEN
    RAISE EXCEPTION 'Only the psychologist can admit patients';
  END IF;

  -- Load session
  SELECT id, psychologist_id, waiting_since, admitted_at
  INTO v_session
  FROM sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Verify this is the psychologist's session
  IF v_session.psychologist_id != v_uid THEN
    RAISE EXCEPTION 'Not your session';
  END IF;

  -- Patient must be in waiting room
  IF v_session.waiting_since IS NULL THEN
    RAISE EXCEPTION 'Patient is not in the waiting room';
  END IF;

  -- Already admitted
  IF v_session.admitted_at IS NOT NULL THEN
    RETURN;  -- idempotent
  END IF;

  -- Write ONLY admitted_at
  UPDATE sessions
  SET admitted_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ============================================================
-- cancel_session: cancel a session with policy enforcement
-- (Requirement 6 - controlled state transition)
-- ============================================================
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_uid;

  -- Load session
  SELECT s.id, s.patient_id, s.psychologist_id, s.status,
         s.scheduled_at, p.user_id AS patient_user_id
  INTO v_session
  FROM sessions s
  JOIN patients p ON p.id = s.patient_id
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Determine who is cancelling
  IF v_role = 'psychologist' AND v_session.psychologist_id = v_uid THEN
    v_cancelled_by := 'psychologist';
  ELSIF v_role = 'patient' AND v_session.patient_user_id = v_uid THEN
    v_cancelled_by := 'patient';
  ELSE
    RAISE EXCEPTION 'Not authorized to cancel this session';
  END IF;

  -- Cannot cancel completed/in-progress/already cancelled sessions
  IF v_session.status NOT IN ('scheduled', 'confirmed') THEN
    RAISE EXCEPTION 'Session cannot be cancelled in status %', v_session.status;
  END IF;

  -- Cannot cancel past sessions
  IF v_session.scheduled_at < now() - interval '30 minutes' THEN
    RAISE EXCEPTION 'Cannot cancel a session that has already passed';
  END IF;

  UPDATE sessions
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_cancelled_by,
      cancellation_reason = p_reason,
      waiting_since = NULL,
      admitted_at = NULL
  WHERE id = p_session_id;
END;
$$;

-- ============================================================
-- fn_verify_audit_chain: verify hash chain integrity
-- (Requirement 32 - verification query)
-- ============================================================
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
  -- Only psychologist can verify
  v_uid := auth.uid();
  SELECT p.role INTO v_role FROM profiles p WHERE p.id = v_uid;
  IF v_role != 'psychologist' THEN
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

    -- Recompute expected hash
    canonical := json_build_object(
      'id', rec.id,
      'actor_id', rec.actor_id,
      'actor_source', rec.actor_source,
      'patient_id', rec.patient_id,
      'action', rec.action,
      'target_id', rec.target_id,
      'target_table', rec.target_table,
      'ip', rec.ip,
      'user_agent', rec.user_agent,
      'metadata', rec.metadata,
      'occurred_at', rec.occurred_at,
      'prev_hash', encode(COALESCE(rec.prev_hash, '\x00'::bytea), 'hex')
    )::TEXT;

    v_expected_hash := digest(canonical, 'sha256');

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
