import "server-only"

/**
 * Invite token validation utility.
 *
 * NOT a server action — called from Server Components.
 * Uses admin client because email_action_tokens has no RLS
 * policy for anon/authenticated.
 *
 * @see architecture.md §8.3
 */

import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { logError } from "@/lib/logger"

export type InviteTokenStatus = "valid" | "expired" | "used" | "invalid"

export interface InviteTokenResult {
  status: InviteTokenStatus
  patientName?: string
}

/**
 * Validate an invite token WITHOUT consuming it.
 *
 * Used on page load to show the correct state (valid, expired, used).
 * The actual consumption happens in acceptInvite server action.
 */
export async function validateInviteToken(
  rawToken: string,
): Promise<InviteTokenResult> {
  try {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex")
    const adminClient = createAdminClient()

    const { data: token } = await adminClient
      .from("email_action_tokens")
      .select("id, purpose, patient_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .eq("purpose", "invite")
      .maybeSingle()

    if (!token) {
      return { status: "invalid" }
    }

    if (token.used_at) {
      return { status: "used" }
    }

    if (new Date(token.expires_at) < new Date()) {
      return { status: "expired" }
    }

    // Get patient name for display
    let patientName: string | undefined
    if (token.patient_id) {
      const { data: patient } = await adminClient
        .from("patients")
        .select("full_name")
        .eq("id", token.patient_id)
        .single()
      patientName = patient?.full_name
    }

    return { status: "valid", patientName }
  } catch {
    logError({
      event_type: "action_error",
      action: "validateInviteToken",
      error_code: "INTERNAL_ERROR",
    })
    return { status: "invalid" }
  }
}
