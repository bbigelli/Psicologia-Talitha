import "server-only"

/**
 * Supabase admin client — bypasses RLS via service_role key.
 *
 * SECURITY: This is the ONLY module that instantiates a service_role client.
 * Importing this module outside the allowlist is grounds for code review rejection.
 * The `server-only` import above prevents Client Components from importing this
 * module — a build error is thrown if attempted.
 *
 * Allowlist (architecture.md §6.2):
 * - Patient invite creation (auth.admin.createUser)
 * - Edge Function issue-livekit-token session lookup
 * - Webhook asaas-webhook transactional write
 * - Edge Function create-charge record read
 */
import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL — admin client cannot be created",
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
