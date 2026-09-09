-- Migration: RLS policies
-- Talitha Psicologia
--
-- Convention: [table]_[operation]_[who]
-- Every table has RLS enabled (done in table creation).
-- Every cell in the RLS matrix is an explicit decision.

-- ============================================================
-- profiles
-- ============================================================

-- Psychologist sees all profiles (needs patient list)
CREATE POLICY profiles_select_psychologist ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

-- Patient sees own profile + psychologist profile (for CRP display)
CREATE POLICY profiles_select_patient_own ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR role = 'psychologist'
  );

-- Any authenticated user can update own profile (except role column - enforced below)
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No INSERT by authenticated (profiles created by server on auth user creation)
-- No DELETE by authenticated

-- Trigger: prevent role column change by any user
CREATE OR REPLACE FUNCTION fn_profiles_protect_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Changing role is not permitted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_protect_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_profiles_protect_role();

-- Trigger: sync role to auth.users app_metadata (Requirement 13)
CREATE OR REPLACE FUNCTION fn_profiles_sync_role_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_profiles_sync_role_metadata
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_profiles_sync_role_metadata();

-- ============================================================
-- patients
-- ============================================================

-- Psychologist sees all patients
CREATE POLICY patients_select_psychologist ON patients
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

-- Patient sees own record
CREATE POLICY patients_select_patient_own ON patients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE by authenticated on patients
-- (created via service_role in Server Action, updated via RPCs)

-- ============================================================
-- sessions
-- ============================================================

-- Psychologist sees all their sessions
CREATE POLICY sessions_select_psychologist ON sessions
  FOR SELECT TO authenticated
  USING (
    psychologist_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

-- Patient sees own sessions
CREATE POLICY sessions_select_patient_own ON sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE policies for authenticated/anon on sessions
-- All mutations via SECURITY DEFINER RPCs or service_role
-- (Requirement 6: REVOKE UPDATE applied in grants_revokes migration)

-- ============================================================
-- clinical_records (Requirement 28)
-- NO policy concedes SELECT to patient. aal2 required.
-- ============================================================

CREATE POLICY clinical_records_select_psychologist ON clinical_records
  FOR SELECT TO authenticated
  USING (
    psychologist_id = auth.uid()
    AND (auth.jwt()->>'aal') = 'aal2'
  );

CREATE POLICY clinical_records_insert_psychologist ON clinical_records
  FOR INSERT TO authenticated
  WITH CHECK (
    psychologist_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
    AND (auth.jwt()->>'aal') = 'aal2'
  );

CREATE POLICY clinical_records_update_psychologist ON clinical_records
  FOR UPDATE TO authenticated
  USING (
    psychologist_id = auth.uid()
    AND (auth.jwt()->>'aal') = 'aal2'
  )
  WITH CHECK (
    psychologist_id = auth.uid()
    AND (auth.jwt()->>'aal') = 'aal2'
  );

-- No DELETE policy (soft delete only, controlled by application)

-- ============================================================
-- clinical_record_versions (same as clinical_records)
-- ============================================================

CREATE POLICY clinical_record_versions_select_psychologist ON clinical_record_versions
  FOR SELECT TO authenticated
  USING (
    edited_by = auth.uid()
    AND (auth.jwt()->>'aal') = 'aal2'
  );

-- Insert only (append-only)
CREATE POLICY clinical_record_versions_insert_psychologist ON clinical_record_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    edited_by = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
    AND (auth.jwt()->>'aal') = 'aal2'
  );

-- ============================================================
-- anamnesis (Requirement 28)
-- Patient has INSERT/UPDATE/SELECT own (without ciphertext columns)
-- Psychologist has SELECT. aal2 required for psychologist.
-- ============================================================

CREATE POLICY anamnesis_select_psychologist ON anamnesis
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients pt
      WHERE pt.id = anamnesis.patient_id
        AND pt.psychologist_id = auth.uid()
    )
    AND (auth.jwt()->>'aal') = 'aal2'
  );

-- Patient can see own anamnesis metadata (ciphertext columns REVOKEd separately)
CREATE POLICY anamnesis_select_patient_own ON anamnesis
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

CREATE POLICY anamnesis_insert_patient ON anamnesis
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

CREATE POLICY anamnesis_update_patient ON anamnesis
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

-- No DELETE policy (retention-protected)

-- ============================================================
-- session_note_drafts (Requirement 23)
-- Only psychologist - NO SELECT for patient. aal2.
-- ============================================================

CREATE POLICY session_note_drafts_select_psychologist ON session_note_drafts
  FOR SELECT TO authenticated
  USING (
    psychologist_id = auth.uid()
    AND (auth.jwt()->>'aal') = 'aal2'
  );

CREATE POLICY session_note_drafts_insert_psychologist ON session_note_drafts
  FOR INSERT TO authenticated
  WITH CHECK (
    psychologist_id = auth.uid()
    AND (auth.jwt()->>'aal') = 'aal2'
  );

CREATE POLICY session_note_drafts_update_psychologist ON session_note_drafts
  FOR UPDATE TO authenticated
  USING (psychologist_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2')
  WITH CHECK (psychologist_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2');

CREATE POLICY session_note_drafts_delete_psychologist ON session_note_drafts
  FOR DELETE TO authenticated
  USING (psychologist_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2');

-- ============================================================
-- charges
-- ============================================================

CREATE POLICY charges_select_psychologist ON charges
  FOR SELECT TO authenticated
  USING (
    psychologist_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

CREATE POLICY charges_select_patient_own ON charges
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE for authenticated (managed by server/edge functions)

-- ============================================================
-- subscriptions
-- ============================================================

CREATE POLICY subscriptions_select_psychologist ON subscriptions
  FOR SELECT TO authenticated
  USING (psychologist_id = auth.uid());

CREATE POLICY subscriptions_select_patient_own ON subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

-- ============================================================
-- payment_webhook_events - NO policies for authenticated
-- (written by Edge Function with service_role)
-- ============================================================

-- ============================================================
-- receipt_counters - NO policies for authenticated
-- (used internally by receipt creation transaction)
-- ============================================================

-- ============================================================
-- receipts
-- ============================================================

CREATE POLICY receipts_select_psychologist ON receipts
  FOR SELECT TO authenticated
  USING (psychologist_id = auth.uid());

CREATE POLICY receipts_select_patient_own ON receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

-- ============================================================
-- consents (append-only, no UPDATE/DELETE)
-- ============================================================

CREATE POLICY consents_select_psychologist ON consents
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

CREATE POLICY consents_select_patient_own ON consents
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

CREATE POLICY consents_insert_patient ON consents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

-- No UPDATE or DELETE policies (append-only)

-- ============================================================
-- communication_preferences
-- ============================================================

CREATE POLICY comm_prefs_select_own ON communication_preferences
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

CREATE POLICY comm_prefs_update_patient ON communication_preferences
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

-- ============================================================
-- email_action_tokens - NO policies (Requirement 19)
-- Access ONLY via SECURITY DEFINER RPCs
-- ============================================================

-- ============================================================
-- data_subject_requests
-- ============================================================

CREATE POLICY dsr_select_psychologist ON data_subject_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

CREATE POLICY dsr_select_patient_own ON data_subject_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

CREATE POLICY dsr_insert_patient ON data_subject_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

-- ============================================================
-- session_reminders
-- ============================================================

CREATE POLICY session_reminders_select_psychologist ON session_reminders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id AND s.psychologist_id = auth.uid()
    )
  );

-- ============================================================
-- billing_rule_events
-- ============================================================

CREATE POLICY billing_rule_events_select_psychologist ON billing_rule_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM charges c
      WHERE c.id = charge_id AND c.psychologist_id = auth.uid()
    )
  );

-- ============================================================
-- audit_log (Layer 1 - Requirement 3)
-- SELECT only for psychologist. No INSERT/UPDATE/DELETE policies.
-- INSERT via SECURITY DEFINER functions only.
-- ============================================================

CREATE POLICY audit_log_select_psychologist ON audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

-- No INSERT/UPDATE/DELETE policies = denied by default
