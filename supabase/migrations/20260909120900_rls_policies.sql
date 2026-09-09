-- Migration: RLS policies
-- Talitha Psicologia
--
-- Convention: [table]_[operation]_[who]
-- Every table has RLS enabled (done in table creation).
-- Every cell in the RLS matrix is an explicit decision.
--
-- Patches applied:
--   B2: trigger preventing patients from writing psychologist columns
--   E6: remote_viability_assessments policies

-- ============================================================
-- profiles
-- ============================================================

CREATE POLICY profiles_select_psychologist ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

CREATE POLICY profiles_select_patient_own ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR role = 'psychologist'
  );

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

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

-- B2: prevent patients from writing psychologist-specific columns
CREATE OR REPLACE FUNCTION fn_profiles_protect_psychologist_columns()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role = 'patient' THEN
    IF NEW.crp IS DISTINCT FROM OLD.crp
       OR NEW.crp_region IS DISTINCT FROM OLD.crp_region
       OR NEW.specialty IS DISTINCT FROM OLD.specialty
       OR NEW.default_session_value IS DISTINCT FROM OLD.default_session_value
       OR NEW.cancellation_policy_hours IS DISTINCT FROM OLD.cancellation_policy_hours
       OR NEW.cpf_ciphertext IS DISTINCT FROM OLD.cpf_ciphertext
    THEN
      RAISE EXCEPTION 'Patient cannot modify psychologist-specific fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_protect_psychologist_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_profiles_protect_psychologist_columns();

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

CREATE POLICY patients_select_psychologist ON patients
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

CREATE POLICY patients_select_patient_own ON patients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- sessions
-- ============================================================

CREATE POLICY sessions_select_psychologist ON sessions
  FOR SELECT TO authenticated
  USING (
    psychologist_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );

CREATE POLICY sessions_select_patient_own ON sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM patients pt WHERE pt.id = patient_id AND pt.user_id = auth.uid())
  );

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

-- ============================================================
-- clinical_record_versions (same as clinical_records)
-- ============================================================

CREATE POLICY clinical_record_versions_select_psychologist ON clinical_record_versions
  FOR SELECT TO authenticated
  USING (
    edited_by = auth.uid()
    AND (auth.jwt()->>'aal') = 'aal2'
  );

CREATE POLICY clinical_record_versions_insert_psychologist ON clinical_record_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    edited_by = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
    AND (auth.jwt()->>'aal') = 'aal2'
  );

-- ============================================================
-- anamnesis (Requirement 28)
-- ============================================================

CREATE POLICY anamnesis_select_psychologist ON anamnesis
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients pt
      WHERE pt.id = anamnesis.patient_id AND pt.psychologist_id = auth.uid()
    )
    AND (auth.jwt()->>'aal') = 'aal2'
  );

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

-- ============================================================
-- session_note_drafts (Requirement 23) — psychologist only, aal2
-- ============================================================

CREATE POLICY session_note_drafts_select_psychologist ON session_note_drafts
  FOR SELECT TO authenticated
  USING (psychologist_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2');

CREATE POLICY session_note_drafts_insert_psychologist ON session_note_drafts
  FOR INSERT TO authenticated
  WITH CHECK (psychologist_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2');

CREATE POLICY session_note_drafts_update_psychologist ON session_note_drafts
  FOR UPDATE TO authenticated
  USING (psychologist_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2')
  WITH CHECK (psychologist_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2');

CREATE POLICY session_note_drafts_delete_psychologist ON session_note_drafts
  FOR DELETE TO authenticated
  USING (psychologist_id = auth.uid() AND (auth.jwt()->>'aal') = 'aal2');

-- ============================================================
-- remote_viability_assessments (E6)
-- Same pattern as clinical_records: psychologist only, aal2
-- ============================================================

CREATE POLICY viability_select_psychologist ON remote_viability_assessments
  FOR SELECT TO authenticated
  USING (
    psychologist_id = auth.uid()
    AND (auth.jwt()->>'aal') = 'aal2'
  );

CREATE POLICY viability_insert_psychologist ON remote_viability_assessments
  FOR INSERT TO authenticated
  WITH CHECK (
    psychologist_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
    AND (auth.jwt()->>'aal') = 'aal2'
  );

-- No UPDATE/DELETE: append-only (triggers block)

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
-- ============================================================

-- ============================================================
-- receipt_counters - NO policies for authenticated
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
-- consents (append-only: INSERT only, no UPDATE/DELETE)
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
    EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_id AND s.psychologist_id = auth.uid())
  );

-- ============================================================
-- billing_rule_events
-- ============================================================

CREATE POLICY billing_rule_events_select_psychologist ON billing_rule_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM charges c WHERE c.id = charge_id AND c.psychologist_id = auth.uid())
  );

-- ============================================================
-- audit_log (Layer 1 - Requirement 3)
-- ============================================================

CREATE POLICY audit_log_select_psychologist ON audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );
