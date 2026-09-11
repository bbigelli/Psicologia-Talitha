-- Migration patch: pg_net timeout for cron Edge Function calls
-- Talitha Psicologia
--
-- Problem: net.http_post defaults to 5000 ms timeout. Supabase Edge
-- Functions have cold start (~3-6s when the Deno isolate boots after
-- inactivity). With 15-min cron intervals, the isolate is often cold,
-- and the first call times out. net._http_response shows timed_out=true
-- while the function likely executed (DNS resolved, TCP started) — but
-- "likely" is not acceptable for patient reminders.
--
-- Fix: explicit timeout_milliseconds := 30000 (30s).
--
-- Why 30s:
-- - Cold start measured at ~5s; 30s gives 6x margin
-- - Edge Function execution measured at 280-546 ms when warm
-- - Supabase Edge Function max execution: 60s (Pro) / 26s (free)
-- - 30s < both limits, so a timeout here means the function genuinely
--   failed, not that we gave up too early
-- - The call is asynchronous (pg_net queues it) — 30s timeout does NOT
--   block the cron job or any database connection for 30s. It only
--   tells pg_net's background worker how long to wait for the response.
--
-- DO NOT reduce this to "optimize". The 5s default was the cause of
-- silent failures that made patient reminders unreliable.
--
-- Warm-up rejected: two calls (warm-up + real) means double processing
-- if both complete before the function's own idempotency check. The
-- timeout increase is the clean fix — it addresses the root cause
-- (insufficient wait) instead of working around it (pre-warming).

CREATE OR REPLACE FUNCTION fn_cron_invoke_edge_function(p_function_name TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_secret TEXT;
  v_base_url TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret';

  IF v_secret IS NULL THEN
    RAISE WARNING '[cron] cron_secret not found in Vault — % skipped', p_function_name;
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_base_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_functions_url';

  IF v_base_url IS NULL THEN
    RAISE WARNING '[cron] supabase_functions_url not found in Vault — % skipped', p_function_name;
    RETURN NULL;
  END IF;

  -- timeout_milliseconds: 30s, not the 5s default.
  -- Covers cold start (~5s) with large margin. See migration header for rationale.
  -- DO NOT reduce without measuring cold start latency first.
  SELECT net.http_post(
    url := v_base_url || '/functions/v1/' || p_function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Re-apply REVOKE (CREATE OR REPLACE resets grants via PUBLIC inheritance)
REVOKE EXECUTE ON FUNCTION fn_cron_invoke_edge_function FROM PUBLIC, anon, authenticated;
