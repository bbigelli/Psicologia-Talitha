-- Migration: Financial tables
-- Talitha Psicologia

-- ============================================================
-- charges
-- Purpose: payment charges linked to Asaas. Status follows
-- a monotonic state machine (Requirement 10, 31).
-- LGPD classification: D11 (Interno/Confidencial)
-- Retention: 5 years (fiscal obligation)
-- ============================================================
CREATE TABLE charges (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  psychologist_id         UUID NOT NULL REFERENCES profiles(id),
  session_id              UUID REFERENCES sessions(id) ON DELETE SET NULL,
  subscription_id         UUID, -- FK added after subscriptions table

  -- Asaas integration
  asaas_payment_id        TEXT UNIQUE,
  asaas_customer_id       TEXT,

  -- Charge details
  amount                  NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  due_date                DATE NOT NULL,
  payment_method          TEXT CHECK (payment_method IS NULL OR payment_method IN (
                            'pix', 'boleto', 'credit_card'
                          )),
  description             TEXT NOT NULL DEFAULT 'Prestacao de servicos profissionais',

  -- Monotonic state machine (Requirement 10)
  -- pending_creation -> pending -> overdue -> paid -> refunded/chargeback
  -- paid can only go to refunded/chargeback, never back
  status                  TEXT NOT NULL DEFAULT 'pending_creation'
                            CHECK (status IN (
                              'pending_creation', 'pending', 'overdue',
                              'paid', 'refunded', 'chargeback', 'cancelled'
                            )),
  last_status_change_at   TIMESTAMPTZ DEFAULT now() NOT NULL,

  paid_at                 TIMESTAMPTZ,
  refunded_at             TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE charges ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_charges_updated_at
  BEFORE UPDATE ON charges
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Monotonic state machine enforcement trigger (Requirement 10)
CREATE OR REPLACE FUNCTION fn_charges_monotonic_status()
RETURNS TRIGGER AS $$
DECLARE
  valid_transition BOOLEAN;
BEGIN
  -- Define valid transitions
  valid_transition := CASE
    WHEN OLD.status = 'pending_creation' AND NEW.status IN ('pending', 'cancelled') THEN true
    WHEN OLD.status = 'pending'          AND NEW.status IN ('paid', 'overdue', 'cancelled') THEN true
    WHEN OLD.status = 'overdue'          AND NEW.status IN ('paid', 'cancelled') THEN true
    WHEN OLD.status = 'paid'             AND NEW.status IN ('refunded', 'chargeback') THEN true
    WHEN OLD.status = NEW.status THEN true  -- no-op
    ELSE false
  END;

  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Invalid charge status transition: % -> %', OLD.status, NEW.status;
  END IF;

  NEW.last_status_change_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_charges_monotonic_status
  BEFORE UPDATE OF status ON charges
  FOR EACH ROW EXECUTE FUNCTION fn_charges_monotonic_status();

-- ============================================================
-- subscriptions
-- Purpose: recurring payment subscriptions via Asaas.
-- LGPD classification: D11 (Interno)
-- Retention: 5 years (fiscal)
-- ============================================================
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  psychologist_id         UUID NOT NULL REFERENCES profiles(id),
  asaas_subscription_id   TEXT UNIQUE,

  monthly_value           NUMERIC(10, 2) NOT NULL CHECK (monthly_value > 0),
  billing_day             INT NOT NULL CHECK (billing_day BETWEEN 1 AND 28),
  sessions_per_cycle      INT NOT NULL CHECK (sessions_per_cycle > 0),
  sessions_used_in_cycle  INT NOT NULL DEFAULT 0,
  current_cycle_start     DATE,

  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'cancelled')),

  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Only one active subscription per patient
  CONSTRAINT uq_patient_active_subscription UNIQUE (patient_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Add FK from charges to subscriptions now that it exists
ALTER TABLE charges
  ADD CONSTRAINT fk_charges_subscription
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;

-- ============================================================
-- payment_webhook_events
-- Purpose: idempotent webhook processing (Requirement 7).
-- PK = asaas_event_id. NO raw payload. Allowlist columns only.
-- CPF and full name PROHIBITED.
-- LGPD classification: D11 (Interno)
-- Retention: 5 years
-- ============================================================
CREATE TABLE payment_webhook_events (
  asaas_event_id          TEXT PRIMARY KEY,
  event_type              TEXT NOT NULL,
  payment_id              TEXT NOT NULL,
  status                  TEXT,
  value                   NUMERIC(10, 2),
  due_date                DATE,
  received_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at            TIMESTAMPTZ,
  result                  TEXT
);

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- receipt_counters
-- Purpose: transactional receipt numbering (Requirement 8).
-- SELECT FOR UPDATE serializes access. No SEQUENCE (gaps).
-- LGPD classification: N/A (structural)
-- ============================================================
CREATE TABLE receipt_counters (
  year                    INT PRIMARY KEY,
  last_number             INT NOT NULL DEFAULT 0
);

ALTER TABLE receipt_counters ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- receipts
-- Purpose: IRPF receipts. UNIQUE(charge_id) ensures at most
-- one receipt per charge (Requirement 9).
-- LGPD classification: D11 (Confidencial - aggregates D3+D5)
-- Retention: 5 years (fiscal)
-- ============================================================
CREATE TABLE receipts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id               UUID NOT NULL REFERENCES charges(id) ON DELETE RESTRICT,
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  psychologist_id         UUID NOT NULL REFERENCES profiles(id),

  -- Receipt content (snapshots at time of generation)
  receipt_number          INT NOT NULL,
  receipt_year            INT NOT NULL,
  receipt_display         TEXT NOT NULL,    -- e.g. '001/2026'

  -- Snapshot fields (Bill Inmon: historical accuracy)
  patient_name            TEXT NOT NULL,
  psychologist_name       TEXT NOT NULL,
  psychologist_crp        TEXT NOT NULL,
  service_description     TEXT NOT NULL DEFAULT 'Sessao de atendimento psicologico online',
  session_date            DATE,
  amount                  NUMERIC(10, 2) NOT NULL,
  payment_method          TEXT,

  -- CPF snapshots (encrypted, decrypted only for PDF generation)
  patient_cpf_ciphertext  BYTEA NOT NULL,
  patient_cpf_iv          BYTEA NOT NULL,
  patient_cpf_tag         BYTEA NOT NULL,
  patient_cpf_dek_wrapped BYTEA NOT NULL,
  patient_cpf_dek_iv      BYTEA NOT NULL,
  patient_cpf_dek_tag     BYTEA NOT NULL,
  psych_cpf_ciphertext    BYTEA NOT NULL,
  psych_cpf_iv            BYTEA NOT NULL,
  psych_cpf_tag           BYTEA NOT NULL,
  psych_cpf_dek_wrapped   BYTEA NOT NULL,
  psych_cpf_dek_iv        BYTEA NOT NULL,
  psych_cpf_dek_tag       BYTEA NOT NULL,
  cpf_kek_version         SMALLINT NOT NULL DEFAULT 1,

  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'cancelled')),

  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT uq_receipt_charge UNIQUE (charge_id),
  CONSTRAINT uq_receipt_number_year UNIQUE (receipt_number, receipt_year)
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
