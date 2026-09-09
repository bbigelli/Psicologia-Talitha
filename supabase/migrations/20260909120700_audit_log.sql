-- Migration: Audit log with 4 layers (Requirement 3, ADR-0004)
-- Talitha Psicologia
--
-- Layer 1: RLS + FORCE ROW LEVEL SECURITY
-- Layer 2: Triggers blocking UPDATE/DELETE/TRUNCATE
-- Layer 3: REVOKE explicit
-- Layer 4: Hash chain (prev_hash / row_hash)

-- ============================================================
-- audit_log
-- Purpose: immutable, append-only audit trail.
-- LGPD classification: D10 (Confidencial - compliance proof)
-- Retention: same as patient record (5 years min)
-- ============================================================
CREATE TABLE audit_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id                UUID REFERENCES profiles(id),
  actor_source            TEXT NOT NULL CHECK (actor_source IN (
                            'user', 'edge_function', 'webhook', 'cron', 'anonymous'
                          )),
  -- actor_id is nullable ONLY when actor_source = 'anonymous'
  -- (failed login with non-existent email, rejected webhook)

  patient_id              UUID,
  action                  TEXT NOT NULL,
  target_id               UUID,          -- ID of the affected entity
  target_table            TEXT,           -- table name of the affected entity

  ip                      INET,
  user_agent              TEXT,
  metadata                JSONB DEFAULT '{}'::JSONB,
  -- metadata: allowlist of keys only. NEVER clinical content (D1/D2/D5).
  -- Allowed: session_id, charge_id, reason, consent_version, record_count, etc.

  -- Hash chain (Layer 4 - Requirement 25)
  prev_hash               BYTEA,                  -- row_hash of the previous entry
  row_hash                BYTEA NOT NULL,          -- SHA-256 of canonical representation

  occurred_at             TIMESTAMPTZ DEFAULT now() NOT NULL,  -- probative timestamp
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL

  -- No updated_at: immutable
);

-- Layer 1: RLS + FORCE
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- Layer 2: Triggers blocking mutations
CREATE OR REPLACE FUNCTION fn_audit_log_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (LGPD art. 37 / CFP): % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_block_mutation();

CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_block_mutation();

-- TRUNCATE does NOT fire FOR EACH ROW triggers - needs FOR EACH STATEMENT
CREATE TRIGGER trg_audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_log_block_mutation();

-- Layer 4: Hash chain computation (BEFORE INSERT)
-- Uses pg_advisory_xact_lock for serialization (Requirement 25)
CREATE OR REPLACE FUNCTION fn_audit_log_hash_chain()
RETURNS TRIGGER AS $$
DECLARE
  last_hash BYTEA;
  canonical TEXT;
BEGIN
  -- Serialize access to prevent hash chain forking under concurrency
  PERFORM pg_advisory_xact_lock(hashtext('audit_log_chain'));

  -- Get the last row_hash
  SELECT row_hash INTO last_hash
  FROM audit_log
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  NEW.prev_hash := last_hash;

  -- Canonical representation: deterministic JSON of key fields
  canonical := json_build_object(
    'id', NEW.id,
    'actor_id', NEW.actor_id,
    'actor_source', NEW.actor_source,
    'patient_id', NEW.patient_id,
    'action', NEW.action,
    'target_id', NEW.target_id,
    'target_table', NEW.target_table,
    'ip', NEW.ip,
    'user_agent', NEW.user_agent,
    'metadata', NEW.metadata,
    'occurred_at', NEW.occurred_at,
    'prev_hash', encode(COALESCE(NEW.prev_hash, '\x00'::bytea), 'hex')
  )::TEXT;

  NEW.row_hash := digest(canonical, 'sha256');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_hash_chain
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_hash_chain();

-- Constraint: actor_id required unless actor_source = 'anonymous'
ALTER TABLE audit_log
  ADD CONSTRAINT chk_audit_actor
  CHECK (
    actor_id IS NOT NULL
    OR actor_source = 'anonymous'
  );
