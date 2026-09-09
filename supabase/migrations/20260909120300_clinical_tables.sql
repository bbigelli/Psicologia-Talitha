-- Migration: Clinical tables
-- Talitha Psicologia
-- All clinical content uses envelope encryption (7 columns per table)
--
-- Patches applied:
--   M1: clinical_record_versions append-only triggers (closes R12)
--   E6: remote_viability_assessments table (Res. CFP 09/2024)

-- ============================================================
-- Generic append-only blocker (reused by consents, versions, viability)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_block_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (compliance record): % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- clinical_records
-- Purpose: evolution records per session. Encrypted content.
-- LGPD classification: D1 (Sensivel-LGPD)
-- Retention: 5 years after treatment end (CFP)
-- ============================================================
CREATE TABLE clinical_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  session_id              UUID REFERENCES sessions(id) ON DELETE SET NULL,
  psychologist_id         UUID NOT NULL REFERENCES profiles(id),

  -- Session metadata (not encrypted - needed for listing)
  session_date            DATE NOT NULL,
  duration_minutes        INT,
  mood                    TEXT CHECK (mood IS NULL OR mood IN (
                            'good', 'neutral', 'anxious', 'sad', 'agitated', 'other'
                          )),

  -- Encrypted evolution content (Requirement 1 - envelope encryption)
  -- AAD = patient_id::text || '|' || record_id::text
  content_ciphertext      BYTEA NOT NULL,
  content_iv              BYTEA NOT NULL,    -- 12 bytes
  content_tag             BYTEA NOT NULL,    -- 16 bytes (GCM auth tag)
  dek_wrapped             BYTEA NOT NULL,    -- DEK encrypted with KEK
  dek_iv                  BYTEA NOT NULL,
  dek_tag                 BYTEA NOT NULL,
  kek_version             SMALLINT NOT NULL DEFAULT 1,

  deleted_at              TIMESTAMPTZ,
  retention_until         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_clinical_records_updated_at
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Block DELETE during retention
CREATE TRIGGER trg_clinical_records_block_delete
  BEFORE DELETE ON clinical_records
  FOR EACH ROW EXECUTE FUNCTION fn_block_delete_clinical_retention();

-- ============================================================
-- clinical_record_versions
-- Purpose: append-only version history for evolution edits.
-- Every UPDATE to a clinical_record stores the previous version.
-- LGPD classification: D1 (Sensivel-LGPD)
-- Retention: same as clinical_records
-- ============================================================
CREATE TABLE clinical_record_versions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id               UUID NOT NULL REFERENCES clinical_records(id) ON DELETE RESTRICT,
  version_number          INT NOT NULL,

  -- Snapshot of the encrypted content at the time of edit
  content_ciphertext      BYTEA NOT NULL,
  content_iv              BYTEA NOT NULL,
  content_tag             BYTEA NOT NULL,
  dek_wrapped             BYTEA NOT NULL,
  dek_iv                  BYTEA NOT NULL,
  dek_tag                 BYTEA NOT NULL,
  kek_version             SMALLINT NOT NULL DEFAULT 1,

  mood                    TEXT,
  edited_by               UUID NOT NULL REFERENCES profiles(id),
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT uq_record_version UNIQUE (record_id, version_number)
);

ALTER TABLE clinical_record_versions ENABLE ROW LEVEL SECURITY;

-- M1: append-only enforcement for clinical_record_versions
CREATE TRIGGER trg_clinical_record_versions_no_update
  BEFORE UPDATE ON clinical_record_versions
  FOR EACH ROW EXECUTE FUNCTION fn_block_append_only_mutation();

CREATE TRIGGER trg_clinical_record_versions_no_delete
  BEFORE DELETE ON clinical_record_versions
  FOR EACH ROW EXECUTE FUNCTION fn_block_append_only_mutation();

-- ============================================================
-- anamnesis
-- Purpose: patient intake form. Fields with health data are
-- encrypted; other fields in clear for operability.
-- LGPD classification: D2 (Sensivel-LGPD), D4 (Confidencial)
-- Retention: 5 years after treatment end
-- ============================================================
CREATE TABLE anamnesis (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT UNIQUE,

  -- Non-sensitive fields (clear, for psychologist listing)
  therapy_reason          TEXT,                -- motivo da busca
  previous_treatment      BOOLEAN DEFAULT false,

  -- Encrypted fields (D2 - medication, conditions, emergency contact)
  -- AAD = patient_id::text || '|' || anamnesis_id::text
  content_ciphertext      BYTEA NOT NULL,
  content_iv              BYTEA NOT NULL,
  content_tag             BYTEA NOT NULL,
  dek_wrapped             BYTEA NOT NULL,
  dek_iv                  BYTEA NOT NULL,
  dek_tag                 BYTEA NOT NULL,
  kek_version             SMALLINT NOT NULL DEFAULT 1,

  filled_at               TIMESTAMPTZ,
  deleted_at              TIMESTAMPTZ,
  retention_until         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE anamnesis ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_anamnesis_updated_at
  BEFORE UPDATE ON anamnesis
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_anamnesis_block_delete
  BEFORE DELETE ON anamnesis
  FOR EACH ROW EXECUTE FUNCTION fn_block_delete_clinical_retention();

-- ============================================================
-- session_note_drafts
-- Purpose: encrypted in-session notes (Requirement 23).
-- Clinical content - follows envelope encryption without exception.
-- Auto-saved by Server Action, deleted when evolution is saved.
-- LGPD classification: D1 (Sensivel-LGPD)
-- Retention: short-lived, cleaned up 7 days after session end
-- ============================================================
CREATE TABLE session_note_drafts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  psychologist_id         UUID NOT NULL REFERENCES profiles(id),

  -- Encrypted content (Requirement 23 - envelope)
  -- AAD = patient_id::text || '|' || session_id::text
  content_ciphertext      BYTEA NOT NULL,
  content_iv              BYTEA NOT NULL,
  content_tag             BYTEA NOT NULL,
  dek_wrapped             BYTEA NOT NULL,
  dek_iv                  BYTEA NOT NULL,
  dek_tag                 BYTEA NOT NULL,
  kek_version             SMALLINT NOT NULL DEFAULT 1,

  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT uq_session_note_draft UNIQUE (session_id)
);

ALTER TABLE session_note_drafts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_session_note_drafts_updated_at
  BEFORE UPDATE ON session_note_drafts
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ============================================================
-- E6: remote_viability_assessments
-- Purpose: Res. CFP 09/2024 requires the psychologist to record
-- her assessment of whether the patient is suitable for remote
-- therapy, with date and justification, in the clinical record.
-- This is the document that protects the psychologist before the
-- CRP — treated with the same rigor as the clinical record.
--
-- Modeled as a SEPARATE TABLE (not extension of clinical_records)
-- because:
-- 1. Different lifecycle: one per patient, versionable (not per session)
-- 2. Append-only independently — mixing with clinical_records would
--    require a nullable session_id or discriminator, weakening the model
-- 3. Its own RLS and retention, same pattern as clinical_records
--
-- LGPD classification: D1 (Sensivel-LGPD — clinical content)
-- Retention: 5 years (same as clinical records)
-- ============================================================
CREATE TABLE remote_viability_assessments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  psychologist_id         UUID NOT NULL REFERENCES profiles(id),
  version_number          INT NOT NULL DEFAULT 1,

  -- Verdict: is the patient suitable for remote therapy?
  is_viable               BOOLEAN NOT NULL,

  -- Encrypted justification (clinical content — envelope encryption)
  -- AAD = patient_id::text || '|' || assessment_id::text
  content_ciphertext      BYTEA NOT NULL,
  content_iv              BYTEA NOT NULL,
  content_tag             BYTEA NOT NULL,
  dek_wrapped             BYTEA NOT NULL,
  dek_iv                  BYTEA NOT NULL,
  dek_tag                 BYTEA NOT NULL,
  kek_version             SMALLINT NOT NULL DEFAULT 1,

  assessed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  retention_until         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT uq_viability_patient_version UNIQUE (patient_id, version_number)
);

ALTER TABLE remote_viability_assessments ENABLE ROW LEVEL SECURITY;

-- Append-only: no UPDATE/DELETE (new assessment = new version_number)
CREATE TRIGGER trg_viability_no_update
  BEFORE UPDATE ON remote_viability_assessments
  FOR EACH ROW EXECUTE FUNCTION fn_block_append_only_mutation();

CREATE TRIGGER trg_viability_no_delete
  BEFORE DELETE ON remote_viability_assessments
  FOR EACH ROW EXECUTE FUNCTION fn_block_delete_clinical_retention();
