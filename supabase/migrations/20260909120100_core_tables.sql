-- Migration: Core tables (profiles, patients)
-- Talitha Psicologia
--
-- Patches applied:
--   E5: removed epsi_status column (e-Psi desativado, Res. CFP 09/2024)
--   A2: auto-calculate retention_until + safer fn_block_delete_during_retention
--   N1: split retention delete blocker into two functions — one for
--       patients (has treatment_ended_at) and one for clinical tables
--       (resolves treatment_ended_at via patient_id JOIN)

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

  -- Psychologist-specific (E5: epsi_status removed — platform deactivated 2024-08-31)
  crp                     TEXT,
  crp_region              TEXT,
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

-- ============================================================
-- A2: Auto-calculate retention_until when treatment_ended_at is set
-- ============================================================
CREATE OR REPLACE FUNCTION fn_patients_set_retention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.treatment_ended_at IS NOT NULL AND OLD.treatment_ended_at IS NULL THEN
    NEW.retention_until := NEW.treatment_ended_at + interval '5 years';
  END IF;
  IF OLD.retention_until IS NOT NULL
     AND NEW.retention_until IS DISTINCT FROM OLD.retention_until
     AND NEW.retention_until < OLD.retention_until THEN
    RAISE EXCEPTION 'Cannot reduce retention_until (was %, attempted %)',
      OLD.retention_until, NEW.retention_until;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patients_set_retention
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION fn_patients_set_retention();

-- ============================================================
-- N1 FIX: Two separate retention-delete functions
--
-- fn_block_delete_patient_retention — for patients table only
--   Reads OLD.treatment_ended_at and OLD.retention_until directly
--   (both columns exist on patients).
--
-- fn_block_delete_clinical_retention — for clinical tables
--   (clinical_records, anamnesis, remote_viability_assessments)
--   These tables have retention_until and patient_id but NOT
--   treatment_ended_at. The safety-net check resolves
--   treatment_ended_at via JOIN to patients.
-- ============================================================

-- For patients table: columns exist directly on the row
CREATE OR REPLACE FUNCTION fn_block_delete_patient_retention()
RETURNS TRIGGER AS $$
BEGIN
  -- Safety net: treatment ended but retention_until not calculated
  IF OLD.retention_until IS NULL AND OLD.treatment_ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'retention_until not set after treatment end — cannot delete safely';
  END IF;
  -- Block during active retention period
  IF OLD.retention_until IS NOT NULL AND OLD.retention_until > now() THEN
    RAISE EXCEPTION 'Cannot delete record during retention period (until %)', OLD.retention_until;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patients_block_delete
  BEFORE DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION fn_block_delete_patient_retention();

-- For clinical tables: resolve treatment_ended_at via patient_id
CREATE OR REPLACE FUNCTION fn_block_delete_clinical_retention()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_treatment_ended TIMESTAMPTZ;
  v_patient_retention       TIMESTAMPTZ;
BEGIN
  -- Check the row's own retention_until first (if populated)
  IF OLD.retention_until IS NOT NULL AND OLD.retention_until > now() THEN
    RAISE EXCEPTION 'Cannot delete % record during retention period (until %)',
      TG_TABLE_NAME, OLD.retention_until;
  END IF;

  -- Safety net: look up the patient's retention state
  -- Even if this row's retention_until is NULL, the patient's
  -- treatment may have ended with retention still active
  SELECT treatment_ended_at, retention_until
  INTO v_patient_treatment_ended, v_patient_retention
  FROM patients
  WHERE id = OLD.patient_id;

  IF v_patient_retention IS NOT NULL AND v_patient_retention > now() THEN
    RAISE EXCEPTION 'Cannot delete % record — patient retention active (until %)',
      TG_TABLE_NAME, v_patient_retention;
  END IF;

  IF v_patient_treatment_ended IS NOT NULL AND v_patient_retention IS NULL THEN
    RAISE EXCEPTION 'Cannot delete % record — patient treatment ended but retention_until not set',
      TG_TABLE_NAME;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
