-- Migration: pg_cron jobs for Edge Function scheduling
-- Talitha Psicologia — Sprint 5/6 (Agenda + Financeiro)
--
-- Implements Requirement 30 (CRON_SECRET no Vault) and schedules:
--   send-reminders    — every 15 min (lembretes 24h e 1h)
--   billing-rules     — daily 9h BRT (regua de cobranca D-3/D+3/D+7/D+15)
--   cron-cleanup      — daily, purge old cron.job_run_details (> 7 days)
--
-- TIMEZONE: pg_cron runs in the database timezone, which on Supabase is
-- UTC. "9h BRT" = "12h UTC" (UTC-3). The cron expression uses 12, not 9.
-- DO NOT "fix" this to 9 — the bank is in UTC and 9 UTC = 6h BRT.
--
-- NO SECRET VALUE IN THIS FILE — it goes to Git. The operator must
-- populate two Vault secrets via SQL after applying this migration.
-- See "OPERATOR ACTION REQUIRED" section at the end.

-- ============================================================
-- 1. Extensions
-- pg_net is already enabled (migration 120000).
-- pg_cron: on Supabase, must be enabled via Dashboard > Extensions
-- or via SQL. It creates the 'cron' schema.
-- supabase_vault: provides vault.create_secret / vault.decrypted_secrets.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- ============================================================
-- 2. Wrapper function: reads CRON_SECRET from Vault, calls Edge Function
--
-- Using a function instead of inline SQL in cron.schedule because:
-- a) The secret read from Vault is cleanly encapsulated
-- b) The function can RAISE WARNING if secrets are missing (vs silent fail)
-- c) The cron job body stays short and readable
--
-- NOT SECURITY DEFINER: the cron executor is postgres (has full access).
-- SD would add no value and would complicate vault.decrypted_secrets access.
-- REVOKE from PUBLIC/anon/authenticated prevents manual invocation from
-- browser clients — only postgres (cron) calls this.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_cron_invoke_edge_function(p_function_name TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_secret TEXT;
  v_base_url TEXT;
  v_request_id BIGINT;
BEGIN
  -- Read CRON_SECRET from Vault (Requirement 30)
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret';

  IF v_secret IS NULL THEN
    RAISE WARNING '[cron] cron_secret not found in Vault — % skipped', p_function_name;
    RETURN NULL;
  END IF;

  -- Read the Supabase Functions base URL from Vault
  -- (e.g. 'https://<ref>.supabase.co')
  SELECT decrypted_secret INTO v_base_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_functions_url';

  IF v_base_url IS NULL THEN
    RAISE WARNING '[cron] supabase_functions_url not found in Vault — % skipped', p_function_name;
    RETURN NULL;
  END IF;

  -- Call the Edge Function via net.http_post (asynchronous)
  SELECT net.http_post(
    url := v_base_url || '/functions/v1/' || p_function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Prevent browser client invocation — only postgres (cron) calls this
REVOKE EXECUTE ON FUNCTION fn_cron_invoke_edge_function FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 3. Schedule jobs (idempotent — unschedule first if exists)
-- ============================================================

-- Remove existing jobs if re-running migration (idempotency)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send-reminders';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'billing-rules';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cron-cleanup';

-- Job 1: Lembretes de sessao — every 15 minutes
-- Catches both 24h and 1h reminders with reasonable precision.
-- The Edge Function itself is idempotent (UNIQUE(session_id, reminder_type)).
SELECT cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $$SELECT fn_cron_invoke_edge_function('send-reminders')$$
);

-- Job 2: Regua de cobranca — daily at 12:00 UTC (= 09:00 BRT)
-- UTC is the database timezone on Supabase. 12 UTC = 09 BRT (UTC-3).
-- The Edge Function is idempotent (UNIQUE(charge_id, step)).
SELECT cron.schedule(
  'billing-rules',
  '0 12 * * *',
  $$SELECT fn_cron_invoke_edge_function('billing-rules')$$
);

-- Job 3: Cleanup old cron run history — daily at 03:00 UTC
-- cron.job_run_details grows indefinitely. Purge entries > 7 days.
SELECT cron.schedule(
  'cron-cleanup',
  '0 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);

-- ============================================================
-- OPERATOR ACTION REQUIRED — run these AFTER applying the migration
-- (replace the placeholder values with the real ones)
-- ============================================================
--
-- 1. Populate the CRON_SECRET in Vault:
--
--    SELECT vault.create_secret(
--      '<the-actual-cron-secret-value>',
--      'cron_secret',
--      'Bearer token for Edge Function cron calls (send-reminders, billing-rules)'
--    );
--
-- 2. Populate the Supabase Functions base URL in Vault:
--
--    SELECT vault.create_secret(
--      'https://<project-ref>.supabase.co',
--      'supabase_functions_url',
--      'Base URL for Edge Function invocation via pg_cron'
--    );
--
-- 3. Verify both secrets are accessible:
--
--    SELECT name FROM vault.decrypted_secrets
--    WHERE name IN ('cron_secret', 'supabase_functions_url');
--    -- Should return 2 rows
--
-- 4. Verify jobs are scheduled:
--
--    SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
--    -- Should show 3 jobs
