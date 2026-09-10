-- Migration patch: F5 (RLS recursion on profiles) + F5b (missing GRANT UPDATE on cipher columns)
-- Talitha Psicologia
--
-- F5: profiles_select_psychologist subqueries profiles itself → 42P17.
--     13 policies total are affected (1 direct + 10 cascade + 2 chain).
--
-- Fix: SECURITY DEFINER helper function fn_is_psychologist() that reads
-- profiles.role directly, bypassing RLS. This preserves R13 (profiles.role
-- as canonical source — database lookup, not JWT claim).
--
-- Design decision: SD function over JWT claim.
-- R13 required that "policies never trust only the JWT claim". The trigger
-- that syncs role to app_metadata exists for the middleware's fast path.
-- RLS is the slow-but-correct path. Using the JWT in RLS would make both
-- paths trust the JWT, rendering the database source meaningless and
-- failing the Security Review that reproved the architecture once.
-- Cost: one indexed lookup per query (STABLE, not per row). Negligible.
--
-- F5b: GRANT UPDATE on profiles missing cipher columns (cpf_*).
--      Only profiles affected — all other tables use table-level grants.
--
-- Lesson: a policy with subquery on its own table causes 42P17. Testing
-- with anon/mock sessions never exercises the authenticated branch,
-- so the recursion is invisible until the first real login.

-- ============================================================
-- fn_is_psychologist(): SECURITY DEFINER helper for RLS policies
-- Returns TRUE if auth.uid() has role 'psychologist' in profiles.
-- Bypasses profiles RLS (SD privilege), reads canonical source (R13).
-- STABLE: evaluated once per query, not per row.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_is_psychologist()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN v_role = 'psychologist';
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_is_psychologist FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_is_psychologist TO authenticated;

-- ============================================================
-- Drop and recreate all 13 affected policies
-- ============================================================

-- 1. profiles_select_psychologist (THE self-reference)
DROP POLICY IF EXISTS profiles_select_psychologist ON profiles;
CREATE POLICY profiles_select_psychologist ON profiles
  FOR SELECT TO authenticated
  USING (fn_is_psychologist());

-- 2. patients_select_psychologist
DROP POLICY IF EXISTS patients_select_psychologist ON patients;
CREATE POLICY patients_select_psychologist ON patients
  FOR SELECT TO authenticated
  USING (fn_is_psychologist());

-- 3. sessions_select_psychologist
DROP POLICY IF EXISTS sessions_select_psychologist ON sessions;
CREATE POLICY sessions_select_psychologist ON sessions
  FOR SELECT TO authenticated
  USING (
    psychologist_id = auth.uid()
    AND fn_is_psychologist()
  );

-- 4. clinical_records_insert_psychologist
DROP POLICY IF EXISTS clinical_records_insert_psychologist ON clinical_records;
CREATE POLICY clinical_records_insert_psychologist ON clinical_records
  FOR INSERT TO authenticated
  WITH CHECK (
    psychologist_id = auth.uid()
    AND fn_is_psychologist()
    AND (auth.jwt()->>'aal') = 'aal2'
  );

-- 5. clinical_record_versions_insert_psychologist
DROP POLICY IF EXISTS clinical_record_versions_insert_psychologist ON clinical_record_versions;
CREATE POLICY clinical_record_versions_insert_psychologist ON clinical_record_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    edited_by = auth.uid()
    AND fn_is_psychologist()
    AND (auth.jwt()->>'aal') = 'aal2'
  );

-- 6. viability_insert_psychologist
DROP POLICY IF EXISTS viability_insert_psychologist ON remote_viability_assessments;
CREATE POLICY viability_insert_psychologist ON remote_viability_assessments
  FOR INSERT TO authenticated
  WITH CHECK (
    psychologist_id = auth.uid()
    AND fn_is_psychologist()
    AND (auth.jwt()->>'aal') = 'aal2'
  );

-- 7. charges_select_psychologist
DROP POLICY IF EXISTS charges_select_psychologist ON charges;
CREATE POLICY charges_select_psychologist ON charges
  FOR SELECT TO authenticated
  USING (
    psychologist_id = auth.uid()
    AND fn_is_psychologist()
  );

-- 8. consents_select_psychologist
DROP POLICY IF EXISTS consents_select_psychologist ON consents;
CREATE POLICY consents_select_psychologist ON consents
  FOR SELECT TO authenticated
  USING (fn_is_psychologist());

-- 9. comm_prefs_select_own (had OR branch with profiles subquery)
DROP POLICY IF EXISTS comm_prefs_select_own ON communication_preferences;
CREATE POLICY comm_prefs_select_own ON communication_preferences
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
    OR fn_is_psychologist()
  );

-- 10. dsr_select_psychologist
DROP POLICY IF EXISTS dsr_select_psychologist ON data_subject_requests;
CREATE POLICY dsr_select_psychologist ON data_subject_requests
  FOR SELECT TO authenticated
  USING (fn_is_psychologist());

-- 11. session_reminders_select_psychologist (chain: sessions → profiles)
-- Fix: use psychologist check directly instead of going through sessions
DROP POLICY IF EXISTS session_reminders_select_psychologist ON session_reminders;
CREATE POLICY session_reminders_select_psychologist ON session_reminders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id AND s.psychologist_id = auth.uid()
    )
    AND fn_is_psychologist()
  );

-- 12. billing_rule_events_select_psychologist (chain: charges → profiles)
DROP POLICY IF EXISTS billing_rule_events_select_psychologist ON billing_rule_events;
CREATE POLICY billing_rule_events_select_psychologist ON billing_rule_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM charges c
      WHERE c.id = charge_id AND c.psychologist_id = auth.uid()
    )
    AND fn_is_psychologist()
  );

-- 13. audit_log_select_psychologist
DROP POLICY IF EXISTS audit_log_select_psychologist ON audit_log;
CREATE POLICY audit_log_select_psychologist ON audit_log
  FOR SELECT TO authenticated
  USING (fn_is_psychologist());

-- ============================================================
-- F5b: Add cipher columns to GRANT UPDATE on profiles
-- Only profiles is affected — all other tables use table-level grants.
-- The psychologist writes her own CPF during onboarding via Server Action.
-- ============================================================
GRANT UPDATE (
  cpf_ciphertext, cpf_iv, cpf_tag,
  cpf_dek_wrapped, cpf_dek_iv, cpf_dek_tag,
  cpf_kek_version
) ON profiles TO authenticated;
