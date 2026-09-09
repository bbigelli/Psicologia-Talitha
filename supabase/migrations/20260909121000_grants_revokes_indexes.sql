-- Migration: GRANT/REVOKE statements + Indexes
-- Talitha Psicologia
--
-- Patches applied:
--   A4: table-level REVOKE + column-level GRANT for 8 tables with
--       ciphertext (replacing column-level REVOKE which is ineffective
--       if Supabase default privileges grant table-level SELECT)
--   A3: REVOKE on consents for service_role (append-only defense)
--   B1: REVOKE EXECUTE from anon on all RPCs
--
-- IMPORTANT FOR STACK AGENT: with column-level GRANT, select('*')
-- from the browser client will FAIL on tables listed below. This is
-- INTENTIONAL and already a project rule (architecture section 16.18).
-- Always use an explicit column list: select('id, patient_id, ...').
-- Server Actions that need ciphertext must use service_role client.

-- ============================================================
-- REVOKE: Audit log (Layer 3 - Requirement 3)
-- ============================================================
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM authenticated, anon, service_role;
GRANT SELECT ON audit_log TO authenticated;  -- RLS filters

-- ============================================================
-- REVOKE: sessions (Requirement 6 - AC2)
-- ============================================================
REVOKE UPDATE ON sessions FROM authenticated, anon;
REVOKE INSERT ON sessions FROM authenticated, anon;
REVOKE DELETE ON sessions FROM authenticated, anon;

-- ============================================================
-- REVOKE: log_audit_system from authenticated/anon (Requirement 24)
-- ============================================================
REVOKE EXECUTE ON FUNCTION log_audit_system FROM authenticated, anon;

-- ============================================================
-- B1: REVOKE EXECUTE from anon on all RPCs (defense in depth)
-- All RPCs validate auth.uid() internally, but the round-trip
-- should not happen for unauthenticated requests.
-- ============================================================
REVOKE EXECUTE ON FUNCTION log_audit FROM anon;
REVOKE EXECUTE ON FUNCTION enter_waiting_room FROM anon;
REVOKE EXECUTE ON FUNCTION admit_patient FROM anon;
REVOKE EXECUTE ON FUNCTION cancel_session FROM anon;
REVOKE EXECUTE ON FUNCTION fn_verify_audit_chain FROM anon;
REVOKE EXECUTE ON FUNCTION consume_email_token FROM anon;

-- ============================================================
-- A3: REVOKE mutations on consents from service_role
-- (defense in depth — triggers also block, but belt + suspenders)
-- ============================================================
REVOKE UPDATE, DELETE, TRUNCATE ON consents FROM service_role;

-- ============================================================
-- A4: Table-level REVOKE + column-level GRANT
-- For each table with ciphertext columns:
-- 1. REVOKE ALL from authenticated (removes any table-level grant)
-- 2. GRANT SELECT on allowed (non-cipher) columns
-- 3. GRANT INSERT/UPDATE/DELETE where RLS policies require it
--
-- Ciphertext is accessible only via service_role (Server Actions
-- that decrypt) or SECURITY DEFINER RPCs.
-- ============================================================

-- --- patients ---
REVOKE ALL ON patients FROM authenticated;
GRANT SELECT (
  id, user_id, psychologist_id, full_name, email, phone, date_of_birth,
  status, treatment_started_at, treatment_ended_at, deleted_at,
  retention_until, created_at, updated_at
) ON patients TO authenticated;
-- No INSERT/UPDATE/DELETE for authenticated (all via service_role)

-- --- profiles ---
REVOKE ALL ON profiles FROM authenticated;
GRANT SELECT (
  id, role, full_name, email, phone, crp, crp_region,
  specialty, default_session_value, cancellation_policy_hours,
  onboarding_completed, created_at, updated_at
) ON profiles TO authenticated;
GRANT UPDATE (
  full_name, email, phone, crp, crp_region, specialty,
  default_session_value, cancellation_policy_hours,
  onboarding_completed, updated_at
) ON profiles TO authenticated;
-- Note: role NOT in UPDATE grant — trigger also protects, but no grant is better

-- --- clinical_records ---
REVOKE ALL ON clinical_records FROM authenticated;
GRANT SELECT (
  id, patient_id, session_id, psychologist_id, session_date,
  duration_minutes, mood, kek_version, deleted_at, retention_until,
  created_at, updated_at
) ON clinical_records TO authenticated;
-- INSERT/UPDATE need all columns including cipher (Server Action writes encrypted content)
GRANT INSERT ON clinical_records TO authenticated;
GRANT UPDATE ON clinical_records TO authenticated;

-- --- clinical_record_versions ---
REVOKE ALL ON clinical_record_versions FROM authenticated;
GRANT SELECT (
  id, record_id, version_number, kek_version, mood, edited_by, created_at
) ON clinical_record_versions TO authenticated;
GRANT INSERT ON clinical_record_versions TO authenticated;

-- --- anamnesis ---
REVOKE ALL ON anamnesis FROM authenticated;
GRANT SELECT (
  id, patient_id, therapy_reason, previous_treatment, kek_version,
  filled_at, deleted_at, retention_until, created_at, updated_at
) ON anamnesis TO authenticated;
-- Patient fills anamnesis via Server Action (needs INSERT on all columns)
GRANT INSERT ON anamnesis TO authenticated;
GRANT UPDATE ON anamnesis TO authenticated;

-- --- session_note_drafts ---
REVOKE ALL ON session_note_drafts FROM authenticated;
GRANT SELECT (
  id, session_id, patient_id, psychologist_id, kek_version,
  created_at, updated_at
) ON session_note_drafts TO authenticated;
GRANT INSERT ON session_note_drafts TO authenticated;
GRANT UPDATE ON session_note_drafts TO authenticated;
GRANT DELETE ON session_note_drafts TO authenticated;

-- --- receipts ---
REVOKE ALL ON receipts FROM authenticated;
GRANT SELECT (
  id, charge_id, patient_id, psychologist_id, receipt_number,
  receipt_year, receipt_display, patient_name, psychologist_name,
  psychologist_crp, service_description, session_date, amount,
  payment_method, cpf_kek_version, status, created_at
) ON receipts TO authenticated;
-- No INSERT/UPDATE/DELETE for authenticated (created by service_role)

-- --- remote_viability_assessments (E6) ---
REVOKE ALL ON remote_viability_assessments FROM authenticated;
GRANT SELECT (
  id, patient_id, psychologist_id, version_number, is_viable,
  kek_version, assessed_at, retention_until, created_at
) ON remote_viability_assessments TO authenticated;
GRANT INSERT ON remote_viability_assessments TO authenticated;

-- ============================================================
-- INDEXES
-- Justified by queries from dashboard, agenda, history, etc.
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_role ON profiles(role);

-- patients
CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_psychologist_id ON patients(psychologist_id);
CREATE INDEX idx_patients_status ON patients(status);

-- sessions
CREATE INDEX idx_sessions_patient_id ON sessions(patient_id);
CREATE INDEX idx_sessions_psychologist_id ON sessions(psychologist_id);
CREATE INDEX idx_sessions_scheduled_at ON sessions(scheduled_at);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_psychologist_scheduled ON sessions(psychologist_id, scheduled_at);
CREATE INDEX idx_sessions_recurrence_group ON sessions(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

-- clinical_records (NO index on plaintext content)
CREATE INDEX idx_clinical_records_patient_id ON clinical_records(patient_id);
CREATE INDEX idx_clinical_records_session_id ON clinical_records(session_id);
CREATE INDEX idx_clinical_records_patient_date ON clinical_records(patient_id, session_date DESC);

-- clinical_record_versions
CREATE INDEX idx_clinical_record_versions_record_id ON clinical_record_versions(record_id);

-- remote_viability_assessments (E6)
CREATE INDEX idx_viability_patient_id ON remote_viability_assessments(patient_id);

-- charges
CREATE INDEX idx_charges_patient_id ON charges(patient_id);
CREATE INDEX idx_charges_psychologist_id ON charges(psychologist_id);
CREATE INDEX idx_charges_status ON charges(status);
CREATE INDEX idx_charges_due_date ON charges(due_date);
CREATE INDEX idx_charges_asaas_payment_id ON charges(asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX idx_charges_status_due ON charges(status, due_date)
  WHERE status IN ('pending', 'overdue');

-- subscriptions
CREATE INDEX idx_subscriptions_patient_id ON subscriptions(patient_id);

-- payment_webhook_events
CREATE INDEX idx_webhook_events_payment_id ON payment_webhook_events(payment_id);

-- receipts
CREATE INDEX idx_receipts_patient_id ON receipts(patient_id);
CREATE INDEX idx_receipts_psychologist_id ON receipts(psychologist_id);

-- consents
CREATE INDEX idx_consents_patient_id ON consents(patient_id);
CREATE INDEX idx_consents_patient_purpose ON consents(patient_id, purpose, occurred_at DESC);

-- email_action_tokens
CREATE INDEX idx_email_tokens_patient_id ON email_action_tokens(patient_id);
CREATE INDEX idx_email_tokens_session_id ON email_action_tokens(session_id);

-- data_subject_requests
CREATE INDEX idx_dsr_patient_id ON data_subject_requests(patient_id);
CREATE INDEX idx_dsr_status ON data_subject_requests(status)
  WHERE status IN ('pending', 'in_progress');

-- audit_log
CREATE INDEX idx_audit_log_patient_id ON audit_log(patient_id);
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_occurred_at ON audit_log(occurred_at DESC);
CREATE INDEX idx_audit_log_patient_action ON audit_log(patient_id, action, occurred_at DESC);
