-- Migration: Core tables (profiles, patients)
-- Talitha Psicologia

-- ============================================================
-- profiles
-- Purpose: user profile linked to auth.users. role is the
-- canonical source of authorization, mirrored to app_metadata.
-- LGPD classification: D6 (Interno) + D15/D16 (psychologist)
-- Retention: lifetime of the account
-- ============================================================
CREATE TABLE profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                    TEXT NOT NULL CHECK (role IN ('psychologist', 'patient')),
  full_name               TEXT NOT NULL,
  email                   TEXT NOT NULL,
  phone                   TEXT,

  -- Psychologist-specific
  crp                     TEXT,
  crp_region              TEXT,
  epsi_status             TEXT CHECK (epsi_status IS NULL OR epsi_status IN ('active', 'pending')),
  specialty               TEXT,
  default_session_value   NUMERIC(10, 2),
  cancellation_policy_hours INT DEFAULT 24,

  -- Psychologist CPF encrypted (for receipts - D16 Confidential)
  cpf_ciphertext          BYTEA,
  cpf_iv                  BYTEA,
  cpf_tag                 BYTEA,
  cpf_dek_wrapped         BYTEA,
  cpf_dek_iv              BYTEA,
  cpf_dek_tag             BYTEA,
  cpf_kek_version         SMALLINT,

  onboarding_completed    BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ============================================================
-- patients
-- Purpose: patient-specific data. Linked to auth.users when
-- the patient accepts the invitation. Encrypted CPF with
-- HMAC blind index for uniqueness.
-- LGPD classification: D5 (Confidencial - CPF), D6 (Interno)
-- Retention: 5 years after treatment_ended_at (Emenda E1)
-- ============================================================
CREATE TABLE patients (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  psychologist_id         UUID NOT NULL REFERENCES profiles(id),
  full_name               TEXT NOT NULL,
  email                   TEXT NOT NULL,
  phone                   TEXT,
  date_of_birth           DATE NOT NULL,

  -- Encrypted CPF (D5 - Confidencial)
  cpf_ciphertext          BYTEA NOT NULL,
  cpf_iv                  BYTEA NOT NULL,
  cpf_tag                 BYTEA NOT NULL,
  cpf_dek_wrapped         BYTEA NOT NULL,
  cpf_dek_iv              BYTEA NOT NULL,
  cpf_dek_tag             BYTEA NOT NULL,
  cpf_kek_version         SMALLINT NOT NULL DEFAULT 1,
  cpf_hmac                TEXT NOT NULL UNIQUE,  -- HMAC-SHA256 blind index

  status                  TEXT NOT NULL DEFAULT 'invited'
                            CHECK (status IN ('invited', 'active', 'inactive', 'treatment_ended')),
  treatment_started_at    TIMESTAMPTZ,
  treatment_ended_at      TIMESTAMPTZ,
  deleted_at              TIMESTAMPTZ,
  retention_until         TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Requirement 18: age >= 18 at registration (Emenda E1)
  -- Sole enforcement that survives RPC, seed, and manual correction.
  CONSTRAINT chk_patient_adult CHECK (date_of_birth <= current_date - interval '18 years')
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Block physical DELETE during retention period
CREATE OR REPLACE FUNCTION fn_block_delete_during_retention()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.retention_until IS NOT NULL AND OLD.retention_until > now() THEN
    RAISE EXCEPTION 'Cannot delete record during retention period (until %)', OLD.retention_until;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patients_block_delete
  BEFORE DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION fn_block_delete_during_retention();
