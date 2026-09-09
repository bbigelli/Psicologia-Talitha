-- Seed data for DEVELOPMENT ONLY
-- Talitha Psicologia
--
-- WARNING: This file contains FICTIONAL data. NEVER use real
-- patient data in seeds. All patients are >= 18 years old.
-- This seed requires auth.users to exist first (created via
-- Supabase Dashboard or supabase auth commands).
--
-- To use: after provisioning the Supabase project and creating
-- auth users, run this file manually or via supabase db push.
-- Do NOT auto-apply in CI/CD.
--
-- Placeholder UUIDs for auth.users (replace after creating them):
-- Psychologist: 00000000-0000-0000-0000-000000000001
-- Patient 1:    00000000-0000-0000-0000-000000000002
-- Patient 2:    00000000-0000-0000-0000-000000000003
-- Patient 3:    00000000-0000-0000-0000-000000000004

-- NOTE: Encrypted fields (cpf_ciphertext, etc.) must be generated
-- by the application's crypto module at runtime. The seed below
-- uses placeholder bytea values that will NOT decrypt correctly.
-- For development, use the application's seed script that calls
-- the crypto functions.

-- ============================================================
-- receipt_counters initialization (structural seed)
-- ============================================================
INSERT INTO receipt_counters (year, last_number) VALUES
  (2026, 0)
ON CONFLICT (year) DO NOTHING;

-- ============================================================
-- Default communication preferences template
-- Created automatically when a patient is registered.
-- ============================================================
-- (Created by the application during patient onboarding)

-- ============================================================
-- Example: Session statuses and charge statuses for reference
-- (Not actual inserts - documentation of valid states)
-- ============================================================
-- Session statuses: scheduled, confirmed, in_progress, completed, cancelled, no_show
-- Charge statuses: pending_creation, pending, overdue, paid, refunded, chargeback, cancelled
-- Consent purposes: online_therapy, lgpd_clinical, lgpd_asaas, communication
-- Email token purposes: invite, confirm_attendance, cancel_attendance
-- DSR types: access, deletion, correction, portability
-- Audit actions: VIEW_RECORD, CREATE_RECORD, UPDATE_RECORD, VIEW_ANAMNESIS,
--   VIEW_AUDIT_LOG, ISSUE_ROOM_TOKEN, DENY_ROOM_TOKEN, LOGIN_SUCCESS,
--   LOGIN_FAILURE, MFA_CHALLENGE_FAILURE, ACCEPT_CONSENT, REVOKE_CONSENT,
--   END_TREATMENT, PURGE_RECORD, EXPORT_DATA, LGPD_REQUEST,
--   CANCEL_SESSION, CANCEL_CHARGE, CREATE_CHARGE, SEARCH_RECORDS,
--   CONFIRM_ATTENDANCE, WEBHOOK_REJECTED, CREATE_PATIENT
