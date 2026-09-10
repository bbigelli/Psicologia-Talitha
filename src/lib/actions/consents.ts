"use server"

/**
 * Consent Server Actions.
 *
 * Consent records are append-only (enforced by triggers on the DB).
 * Each accept/revoke creates a new row — never updates an existing one.
 *
 * The patient can INSERT into `consents` via RLS policy (consents_insert_patient).
 * No admin client needed for consent writes.
 *
 * @see data-architecture.md §consents (A3: append-only)
 * @see architecture.md §8.3 (A4: consent by purpose)
 */

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { withPatient } from "@/lib/actions/_guard"
import { logAudit } from "@/lib/audit"
import { logError, logInfo } from "@/lib/logger"
import {
  CURRENT_CONSENT_VERSION,
  type AcceptConsentInput,
} from "@/schemas/consent"

/**
 * Accept a single consent (one purpose at a time).
 *
 * Captures IP and User-Agent from the request headers (never from body).
 * Stores consent_text_hash for versioning — if the text changes,
 * the hash changes, and the patient must re-accept.
 */
export const acceptConsent = withPatient(
  async (ctx, input: AcceptConsentInput) => {
    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0"
    const userAgent = headersList.get("user-agent") || "unknown"

    const { error } = await ctx.supabase.from("consents").insert({
      patient_id: ctx.patientId,
      purpose: input.purpose,
      action: "accept",
      consent_text_hash: input.consent_text_hash,
      consent_version: CURRENT_CONSENT_VERSION,
      ip,
      user_agent: userAgent,
    })

    if (error) {
      logError({
        event_type: "consent_accept_failure",
        patient_id: ctx.patientId,
        action: "ACCEPT_CONSENT",
        error_code: "INSERT_FAILED",
      })
      throw new Error("Nao foi possivel registrar o consentimento")
    }

    await logAudit(ctx.supabase, ctx.patientId, "ACCEPT_CONSENT", {
      purpose: input.purpose,
      version: CURRENT_CONSENT_VERSION,
    })

    logInfo({
      event_type: "consent_accepted",
      patient_id: ctx.patientId,
      action: "ACCEPT_CONSENT",
    })

    return undefined
  },
)

/**
 * Accept multiple consents in sequence (for the LGPD page with 2-3 checkboxes).
 *
 * Each consent is a separate row in the database.
 */
export const acceptMultipleConsents = withPatient(
  async (
    ctx,
    input: { consents: AcceptConsentInput[] },
  ) => {
    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0"
    const userAgent = headersList.get("user-agent") || "unknown"

    const rows = input.consents.map((c) => ({
      patient_id: ctx.patientId,
      purpose: c.purpose,
      action: "accept" as const,
      consent_text_hash: c.consent_text_hash,
      consent_version: CURRENT_CONSENT_VERSION,
      ip,
      user_agent: userAgent,
    }))

    const { error } = await ctx.supabase.from("consents").insert(rows)

    if (error) {
      logError({
        event_type: "consent_accept_failure",
        patient_id: ctx.patientId,
        action: "ACCEPT_CONSENT",
        error_code: "INSERT_FAILED",
      })
      throw new Error("Nao foi possivel registrar os consentimentos")
    }

    // Audit each consent separately
    for (const c of input.consents) {
      await logAudit(ctx.supabase, ctx.patientId, "ACCEPT_CONSENT", {
        purpose: c.purpose,
        version: CURRENT_CONSENT_VERSION,
      })
    }

    logInfo({
      event_type: "consents_accepted",
      patient_id: ctx.patientId,
      action: "ACCEPT_CONSENT",
    })

    return undefined
  },
)

/**
 * Revoke LGPD consent.
 *
 * Inserts a new row with action='revoke'. Does NOT delete the accept record
 * (append-only). The middleware checks the latest consent per purpose.
 */
export const revokeConsent = withPatient(
  async (ctx, input: { purpose: string }) => {
    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0"
    const userAgent = headersList.get("user-agent") || "unknown"

    const { error } = await ctx.supabase.from("consents").insert({
      patient_id: ctx.patientId,
      purpose: input.purpose,
      action: "revoke",
      consent_text_hash: "revoked",
      consent_version: CURRENT_CONSENT_VERSION,
      ip,
      user_agent: userAgent,
    })

    if (error) {
      logError({
        event_type: "consent_revoke_failure",
        patient_id: ctx.patientId,
        action: "REVOKE_CONSENT",
        error_code: "INSERT_FAILED",
      })
      throw new Error("Nao foi possivel revogar o consentimento")
    }

    await logAudit(ctx.supabase, ctx.patientId, "REVOKE_CONSENT", {
      purpose: input.purpose,
    })

    logInfo({
      event_type: "consent_revoked",
      patient_id: ctx.patientId,
      action: "REVOKE_CONSENT",
    })

    return undefined
  },
)

/**
 * Check whether a patient has accepted all required consents.
 *
 * Required consents: online_therapy, lgpd_clinical, lgpd_asaas.
 * Communication is optional.
 *
 * Checks the latest record per purpose — if the latest action is 'revoke',
 * the consent is not active.
 */
export async function hasActiveConsents(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  patientId: string,
): Promise<boolean> {
  const requiredPurposes = [
    "online_therapy",
    "lgpd_clinical",
    "lgpd_asaas",
  ]

  const { data: consents } = await supabase
    .from("consents")
    .select("purpose, action, occurred_at")
    .eq("patient_id", patientId)
    .in("purpose", requiredPurposes)
    .order("occurred_at", { ascending: false })

  if (!consents || consents.length === 0) return false

  // Get the latest action for each purpose
  const latestByPurpose = new Map<string, string>()
  for (const c of consents) {
    if (!latestByPurpose.has(c.purpose)) {
      latestByPurpose.set(c.purpose, c.action)
    }
  }

  // All required purposes must have latest action = 'accept'
  return requiredPurposes.every(
    (p) => latestByPurpose.get(p) === "accept",
  )
}
