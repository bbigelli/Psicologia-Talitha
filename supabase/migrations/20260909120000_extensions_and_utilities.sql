-- Migration: Extensions and utility functions
-- Talitha Psicologia - Data Architecture
-- Idempotent where possible (CREATE ... IF NOT EXISTS)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), gen_random_bytes(), digest()
CREATE EXTENSION IF NOT EXISTS "pg_net";     -- net.http_post for cron Edge Function calls

-- Utility function: auto-update updated_at
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
