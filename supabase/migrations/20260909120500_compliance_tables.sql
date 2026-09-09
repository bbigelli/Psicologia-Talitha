-- Migration: Compliance tables
-- Talitha Psicologia
--
-- Patches applied:
--   A3: consents append-only triggers + FORCE RLS + REVOKE (closes R11)

-- ============================================================
-- consents
-- Purpose: append-only consent records (Requirement 11).
-- Immutable. All timestamps in timestamptz UTC.
-- E7: consent text accommodates format online, faltas, queda
--   via consent_text_hash + consent_version — when text changes
--   (adding E7 clauses), version increments and patients re-accept.
--   No schema change needed.
-- LGPD classification: D9 (Confidencial - proof of compliance)
-- Retention: same as patient record (5 years)
-- ============================================================
CREATE TABLE consents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,

  purpose                 TEXT NOT NULL CHECK (purpose IN (
                            'online_therapy',    -- CFP term (Res. 09/2024)
                            'lgpd_clinical',     -- LGPD main consent
                            'lgpd_asaas',        -- data sharing with Asaas
                            'communication'      -- optional email reminders
                          )),

  action                  TEXT NOT NULL CHECK (action IN ('accept', 'revoke')),
  consent_text_hash       TEXT NOT NULL,         -- SHA-256 of the exact text shown
  consent_version         TEXT NOT NULL,          -- e.g. '1.0', '1.1'
  ip                      INET NOT NULL,
  user_agent              TEXT NOT NULL,
  occurred_at             TIMESTAMPTZ DEFAULT now() NOT NULL,  -- probative value
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL
  -- No updated_at: append-only, never updated
);

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
-- A3: FORCE ensures even the table owner respects policies
ALTER TABLE consents FORCE ROW LEVEL SECURITY;

-- A3: append-only enforcement (same rigor as audit_log)
-- fn_block_append_only_mutation is created in 120300_clinical_tables.sql
CREATE TRIGGER trg_consents_no_update
  BEFORE UPDATE ON consents
  FOR EACH ROW EXECUTE FUNCTION fn_block_append_only_mutation();

CREATE TRIGGER trg_consents_no_delete
  BEFORE DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION fn_block_append_only_mutation();

CREATE TRIGGER trg_consents_no_truncate
  BEFORE TRUNCATE ON consents
  FOR EACH STATEMENT EXECUTE FUNCTION fn_block_append_only_mutation();

-- ============================================================
-- communication_preferences
-- Purpose: patient opt-out per channel/purpose (Requirement 22).
-- Checked by reminder and billing rule crons before sending.
-- LGPD classification: D6 (Interno) - eliminable on request
-- ============================================================
CREATE TABLE communication_preferences (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  channel                 TEXT NOT NULL CHECK (channel IN ('email')),
  purpose                 TEXT NOT NULL CHECK (purpose IN (
                            'session_reminders', 'billing_reminders', 'general_notifications'
                          )),
  opted_out               BOOLEAN NOT NULL DEFAULT false,
  opted_out_at            TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT uq_comm_pref UNIQUE (patient_id, channel, purpose)
);

ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_communication_preferences_updated_at
  BEFORE UPDATE ON communication_preferences
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ============================================================
-- email_action_tokens
-- Purpose: hashed tokens for email action links (Requirement 19).
-- Token NEVER stored in clear. One token per action, never a
-- token that accepts action as parameter.
-- RLS: NO policy for authenticated/anon - access ONLY via
-- SECURITY DEFINER RPCs.
-- LGPD classification: D8 (Confidencial)
-- ============================================================
CREATE TABLE email_action_tokens (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash              TEXT UNIQUE NOT NULL,  -- SHA-256 of the actual token
  purpose                 TEXT NOT NULL CHECK (purpose IN (
                            'invite',
                            'confirm_attendance',
                            'cancel_attendance'
                          )),
  patient_id              UUID REFERENCES patients(id) ON DELETE CASCADE,
  session_id              UUID REFERENCES sessions(id) ON DELETE CASCADE,
  expires_at              TIMESTAMPTZ NOT NULL,
  used_at                 TIMESTAMPTZ,
  created_ip              INET,
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE email_action_tokens ENABLE ROW LEVEL SECURITY;
-- Explicitly: NO policies for authenticated or anon.
-- Access only via SECURITY DEFINER RPCs (consume_email_token).

-- ============================================================
-- data_subject_requests
-- Purpose: LGPD requests from patients (Requirement 21).
-- Records the decision, legal basis, and what was
-- eliminated vs retained - required for compliance proof.
-- LGPD classification: D9/D10 (Confidencial - compliance proof)
-- Retention: same as patient record
-- ============================================================
CREATE TABLE data_subject_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,

  request_type            TEXT NOT NULL CHECK (request_type IN (
                            'access', 'deletion', 'correction', 'portability'
                          )),
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                              'pending', 'in_progress', 'completed',
                              'partially_completed', 'denied'
                            )),

  requested_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
  due_at                  TIMESTAMPTZ NOT NULL,  -- 15 business days
  responded_at            TIMESTAMPTZ,

  -- Response documentation (Requirement 21)
  decision                TEXT,          -- explanation of the decision
  legal_basis             TEXT,          -- cited legal basis for retention/denial
  eliminated_categories   JSONB DEFAULT '[]'::JSONB,
  retained_categories     JSONB DEFAULT '[]'::JSONB,

  -- Export artifact (if applicable)
  artifact_path           TEXT,          -- path in Supabase Storage
  artifact_expires_at     TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_data_subject_requests_updated_at
  BEFORE UPDATE ON data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
