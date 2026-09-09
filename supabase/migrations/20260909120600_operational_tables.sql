-- Migration: Operational tables (reminders, billing rule events)
-- Talitha Psicologia

-- ============================================================
-- session_reminders
-- Purpose: idempotent reminder tracking (Requirement 29).
-- UNIQUE (session_id, reminder_type) as bank-level constraint.
-- LGPD classification: D3 (Sensivel-LGPD - metadata)
-- Retention: 1 year
-- ============================================================
CREATE TABLE session_reminders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  reminder_type           TEXT NOT NULL CHECK (reminder_type IN ('24h', '1h')),
  sent_at                 TIMESTAMPTZ,
  provider_message_id     TEXT,
  delivery_status         TEXT NOT NULL DEFAULT 'pending'
                            CHECK (delivery_status IN ('pending', 'sent', 'failed', 'delivered')),
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT uq_session_reminder UNIQUE (session_id, reminder_type)
);

ALTER TABLE session_reminders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- billing_rule_events
-- Purpose: idempotent billing rule execution (Requirement 29).
-- UNIQUE (charge_id, step) as bank-level constraint.
-- LGPD classification: D11 (Interno)
-- Retention: 1 year
-- ============================================================
CREATE TABLE billing_rule_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id               UUID NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
  step                    TEXT NOT NULL CHECK (step IN (
                            'd_minus_3', 'd_plus_3', 'd_plus_7', 'd_plus_15'
                          )),
  sent_at                 TIMESTAMPTZ,
  provider_message_id     TEXT,
  delivery_status         TEXT NOT NULL DEFAULT 'pending'
                            CHECK (delivery_status IN ('pending', 'sent', 'failed', 'delivered')),
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT uq_billing_rule_event UNIQUE (charge_id, step)
);

ALTER TABLE billing_rule_events ENABLE ROW LEVEL SECURITY;
