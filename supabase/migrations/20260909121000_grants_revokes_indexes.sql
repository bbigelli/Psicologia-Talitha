-- Migration: GRANT/REVOKE statements + Indexes
-- Talitha Psicologia

-- ============================================================
-- REVOKE: Audit log (Layer 3 - Requirement 3)
-- ============================================================
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM authenticated, anon, service_role;
GRANT SELECT ON audit_log TO authenticated;  -- RLS filters
-- INSERT only via SECURITY DEFINER functions

-- ============================================================
-- REVOKE: sessions (Requirement 6 - AC2)
-- Patients and anon NEVER get UPDATE on sessions.
-- All mutations via SECURITY DEFINER RPCs.
-- ============================================================
REVOKE UPDATE ON sessions FROM authenticated, anon;
REVOKE INSERT ON sessions FROM authenticated, anon;
REVOKE DELETE ON sessions FROM authenticated, anon;
-- Sessions created/updated by service_role (Server Actions) and RPCs

-- ============================================================
-- REVOKE: log_audit_system from authenticated/anon (Requirement 24)
-- Only service_role can call log_audit_system
-- ============================================================
REVOKE EXECUTE ON FUNCTION log_audit_system FROM authenticated, anon;

-- ============================================================
-- REVOKE: encrypted columns from authenticated (Requirement 27)
-- Prevents browser client from selecting ciphertext.
-- Server-side reads via service_role bypass these.
-- ============================================================

-- patients: encrypted CPF columns
REVOKE SELECT (cpf_ciphertext, cpf_iv, cpf_tag, cpf_dek_wrapped, cpf_dek_iv, cpf_dek_tag, cpf_kek_version, cpf_hmac)
  ON patients FROM authenticated;

-- profiles: encrypted CPF columns (psychologist)
REVOKE SELECT (cpf_ciphertext, cpf_iv, cpf_tag, cpf_dek_wrapped, cpf_dek_iv, cpf_dek_tag, cpf_kek_version)
  ON profiles FROM authenticated;

-- clinical_records: encrypted content columns
REVOKE SELECT (content_ciphertext, content_iv, content_tag, dek_wrapped, dek_iv, dek_tag)
  ON clinical_records FROM authenticated;

-- clinical_record_versions: encrypted content columns
REVOKE SELECT (content_ciphertext, content_iv, content_tag, dek_wrapped, dek_iv, dek_tag)
  ON clinical_record_versions FROM authenticated;

-- anamnesis: encrypted content columns
REVOKE SELECT (content_ciphertext, content_iv, content_tag, dek_wrapped, dek_iv, dek_tag)
  ON anamnesis FROM authenticated;

-- session_note_drafts: encrypted content columns
REVOKE SELECT (content_ciphertext, content_iv, content_tag, dek_wrapped, dek_iv, dek_tag)
  ON session_note_drafts FROM authenticated;

-- receipts: encrypted CPF snapshot columns
REVOKE SELECT (
  patient_cpf_ciphertext, patient_cpf_iv, patient_cpf_tag,
  patient_cpf_dek_wrapped, patient_cpf_dek_iv, patient_cpf_dek_tag,
  psych_cpf_ciphertext, psych_cpf_iv, psych_cpf_tag,
  psych_cpf_dek_wrapped, psych_cpf_dek_iv, psych_cpf_dek_tag
) ON receipts FROM authenticated;

-- ============================================================
-- INDEXES
-- Justified by queries from dashboard, agenda, history, etc.
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_role ON profiles(role);
-- Query: RLS policies filter by role; middleware resolves role

-- patients
CREATE INDEX idx_patients_user_id ON patients(user_id);
-- Query: RLS "user_id = auth.uid()" in every patient policy
CREATE INDEX idx_patients_psychologist_id ON patients(psychologist_id);
-- Query: psychologist listing their patients
CREATE INDEX idx_patients_status ON patients(status);
-- Query: active patient listing (WHERE status = 'active')

-- sessions
CREATE INDEX idx_sessions_patient_id ON sessions(patient_id);
-- Query: patient viewing their sessions
CREATE INDEX idx_sessions_psychologist_id ON sessions(psychologist_id);
-- Query: psychologist viewing agenda
CREATE INDEX idx_sessions_scheduled_at ON sessions(scheduled_at);
-- Query: agenda weekly view (WHERE scheduled_at BETWEEN ... AND ...)
CREATE INDEX idx_sessions_status ON sessions(status);
-- Query: filtering by status (scheduled, cancelled, etc.)
CREATE INDEX idx_sessions_psychologist_scheduled ON sessions(psychologist_id, scheduled_at);
-- Query: agenda view for psychologist sorted by date
CREATE INDEX idx_sessions_recurrence_group ON sessions(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
-- Query: managing recurring sessions

-- clinical_records
CREATE INDEX idx_clinical_records_patient_id ON clinical_records(patient_id);
-- Query: evolution history for a patient
CREATE INDEX idx_clinical_records_session_id ON clinical_records(session_id);
-- Query: evolution linked to session
CREATE INDEX idx_clinical_records_patient_date ON clinical_records(patient_id, session_date DESC);
-- Query: chronological history view with pagination
-- Note: NO index on plaintext content (decrypt-then-filter, Requirement 28)

-- clinical_record_versions
CREATE INDEX idx_clinical_record_versions_record_id ON clinical_record_versions(record_id);

-- anamnesis (UNIQUE on patient_id already creates index)

-- session_note_drafts (UNIQUE on session_id already creates index)

-- charges
CREATE INDEX idx_charges_patient_id ON charges(patient_id);
-- Query: patient payment history
CREATE INDEX idx_charges_psychologist_id ON charges(psychologist_id);
-- Query: psychologist financial views
CREATE INDEX idx_charges_status ON charges(status);
-- Query: dashboard KPIs (pending, paid, overdue)
CREATE INDEX idx_charges_due_date ON charges(due_date);
-- Query: billing rule cron (overdue detection)
CREATE INDEX idx_charges_asaas_payment_id ON charges(asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;
-- Query: webhook lookups by Asaas payment ID
CREATE INDEX idx_charges_status_due ON charges(status, due_date)
  WHERE status IN ('pending', 'overdue');
-- Query: dashboard overdue/pending KPIs, inadimplentes listing

-- subscriptions
CREATE INDEX idx_subscriptions_patient_id ON subscriptions(patient_id);

-- payment_webhook_events
CREATE INDEX idx_webhook_events_payment_id ON payment_webhook_events(payment_id);

-- receipts
CREATE INDEX idx_receipts_patient_id ON receipts(patient_id);
-- Query: patient viewing their receipts
CREATE INDEX idx_receipts_psychologist_id ON receipts(psychologist_id);
-- Query: psychologist receipt listing

-- consents
CREATE INDEX idx_consents_patient_id ON consents(patient_id);
-- Query: consent check before session
CREATE INDEX idx_consents_patient_purpose ON consents(patient_id, purpose, occurred_at DESC);
-- Query: latest consent status per purpose

-- communication_preferences
-- UNIQUE constraint already indexes (patient_id, channel, purpose)

-- email_action_tokens
CREATE INDEX idx_email_tokens_patient_id ON email_action_tokens(patient_id);
CREATE INDEX idx_email_tokens_session_id ON email_action_tokens(session_id);
-- token_hash has UNIQUE index

-- data_subject_requests
CREATE INDEX idx_dsr_patient_id ON data_subject_requests(patient_id);
CREATE INDEX idx_dsr_status ON data_subject_requests(status)
  WHERE status IN ('pending', 'in_progress');
-- Query: psychologist checking pending requests

-- session_reminders
-- UNIQUE constraint already indexes (session_id, reminder_type)

-- billing_rule_events
-- UNIQUE constraint already indexes (charge_id, step)

-- audit_log
CREATE INDEX idx_audit_log_patient_id ON audit_log(patient_id);
-- Query: audit trail for a specific patient
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
-- Query: audit trail by actor
CREATE INDEX idx_audit_log_action ON audit_log(action);
-- Query: filtering by action type
CREATE INDEX idx_audit_log_occurred_at ON audit_log(occurred_at DESC);
-- Query: chronological browsing
CREATE INDEX idx_audit_log_patient_action ON audit_log(patient_id, action, occurred_at DESC);
-- Query: patient-specific action history with pagination
