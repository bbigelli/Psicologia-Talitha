-- Migration: Sessions table
-- Talitha Psicologia

-- ============================================================
-- sessions
-- Purpose: therapy session schedule. room_name is 128-bit
-- random, unique per session, never reused.
-- LGPD classification: D3 (Sensivel-LGPD - existence of
-- therapeutic link), D12 (room metadata)
-- Retention: 5 years (linked to patient retention)
-- ============================================================
CREATE TABLE sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  psychologist_id         UUID NOT NULL REFERENCES profiles(id),

  scheduled_at            TIMESTAMPTZ NOT NULL,
  duration_minutes        INT NOT NULL DEFAULT 50,
  status                  TEXT NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN (
                              'scheduled', 'confirmed', 'in_progress',
                              'completed', 'cancelled', 'no_show'
                            )),

  -- Video room (Requirement 5)
  room_name               TEXT UNIQUE NOT NULL
                            DEFAULT ('s_' || encode(gen_random_bytes(16), 'hex')),

  -- Waiting room state (Requirement 6 - never UPDATE directly)
  waiting_since           TIMESTAMPTZ,
  admitted_at             TIMESTAMPTZ,

  -- Payment linkage
  payment_status          TEXT NOT NULL DEFAULT 'pending'
                            CHECK (payment_status IN ('pending', 'paid', 'overdue', 'refunded', 'waived')),

  -- Recurrence
  recurrence_group_id     UUID,

  -- Cancellation
  cancelled_at            TIMESTAMPTZ,
  cancelled_by            TEXT CHECK (cancelled_by IS NULL OR cancelled_by IN ('psychologist', 'patient', 'system')),
  cancellation_reason     TEXT,

  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Requirement 5: Trigger to regenerate room_name and reset waiting
-- state when scheduled_at changes (reschedule)
CREATE OR REPLACE FUNCTION fn_sessions_on_reschedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    NEW.room_name := 's_' || encode(gen_random_bytes(16), 'hex');
    NEW.waiting_since := NULL;
    NEW.admitted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sessions_on_reschedule
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_sessions_on_reschedule();
