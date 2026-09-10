-- Migration: subscriptions.status pending_creation + state machine + UNIQUE fix
-- Talitha Psicologia — Sprint 5 (Financeiro e Asaas)
--
-- Problem: subscriptions.status allowed only (active, paused, cancelled)
-- with default 'active'. This created a window where a subscription is
-- locally "active" before Asaas confirms creation — and on failure,
-- was marked "cancelled", which is semantically wrong (never existed).
--
-- Fix:
-- 1. Add pending_creation + creation_failed to the status CHECK
-- 2. Change default to pending_creation
-- 3. Replace unconditional UNIQUE(patient_id) with partial index
--    on live statuses only — dead rows don't block new attempts
-- 4. Add monotonic state machine trigger (same pattern as charges)

-- ============================================================
-- 1. Replace the CHECK constraint to add new statuses
-- ============================================================
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'pending_creation', 'active', 'paused',
    'cancelled', 'creation_failed'
  ));

-- ============================================================
-- 2. Change default to pending_creation
-- ============================================================
ALTER TABLE subscriptions ALTER COLUMN status SET DEFAULT 'pending_creation';

-- ============================================================
-- 3. Replace unconditional UNIQUE with partial unique index
--    Only one "live" subscription per patient at a time.
--    Live = pending_creation, active, paused.
--    Dead = cancelled, creation_failed (don't block new attempts).
-- ============================================================
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS uq_patient_active_subscription;

CREATE UNIQUE INDEX uq_patient_live_subscription
  ON subscriptions (patient_id)
  WHERE status IN ('pending_creation', 'active', 'paused');

-- ============================================================
-- 4. Monotonic state machine trigger
--    pending_creation → active | creation_failed
--    active → paused | cancelled
--    paused → active | cancelled
--    creation_failed → (terminal)
--    cancelled → (terminal)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_subscriptions_monotonic_status()
RETURNS TRIGGER AS $$
DECLARE
  valid_transition BOOLEAN;
BEGIN
  valid_transition := CASE
    WHEN OLD.status = 'pending_creation' AND NEW.status IN ('active', 'creation_failed') THEN true
    WHEN OLD.status = 'active'           AND NEW.status IN ('paused', 'cancelled') THEN true
    WHEN OLD.status = 'paused'           AND NEW.status IN ('active', 'cancelled') THEN true
    WHEN OLD.status = NEW.status THEN true  -- no-op
    ELSE false
  END;

  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Invalid subscription status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscriptions_monotonic_status
  BEFORE UPDATE OF status ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_subscriptions_monotonic_status();
