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

import { withPatient } from "@/lib/actions/_guard"
import { logAudit } from "@/lib/audit"
import { logError, logInfo } from "@/lib/logger"
import {
  acceptConsentSchema,
  acceptMultipleConsentsSchema,
  revokeConsentSchema,
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
    const parsed = acceptConsentSchema.parse(input)

    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0"
    const userAgent = headersList.get("user-agent") || "unknown"

    const { error } = await ctx.supabase.from("consents").insert({
      patient_id: ctx.patientId,
      purpose: parsed.purpose,
      action: "accept",
      consent_text_hash: parsed.consent_text_hash,
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
      purpose: parsed.purpose,
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
    const parsed = acceptMultipleConsentsSchema.parse(input)

    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0"
    const userAgent = headersList.get("user-agent") || "unknown"

    const rows = parsed.consents.map((c) => ({
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
    for (const c of parsed.consents) {
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
    const parsed = revokeConsentSchema.parse(input)

    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0"
    const userAgent = headersList.get("user-agent") || "unknown"

    const { error } = await ctx.supabase.from("consents").insert({
      patient_id: ctx.patientId,
      purpose: parsed.purpose,
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
      purpose: parsed.purpose,
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
 * Required consent purposes. Communication is optional.
 */
export const REQUIRED_CONSENT_PURPOSES = [
  "online_therapy",
  "lgpd_clinical",
  "lgpd_asaas",
] as const

/**
 * Check whether a patient has accepted all required consents
 * at the CURRENT version.
 *
 * Required consents: online_therapy, lgpd_clinical, lgpd_asaas.
 * Communication is optional — does NOT require re-accept on version bump.
 *
 * Checks per required purpose:
 * 1. Latest action must be 'accept' (not 'revoke')
 * 2. consent_version of that accept must match CURRENT_CONSENT_VERSION
 *
 * If the version doesn't match, the patient accepted an older version
 * of the text and must re-accept before proceeding. The new accept
 * is a NEW row (append-only), preserving the full history.
 *
 * Decision on optional 'communication' purpose: does NOT force re-accept
 * on version change. Rationale: it's opt-in, the patient actively chose it,
 * and forcing re-confirmation on every text revision creates attrition that
 * leads to opt-out. The old text is preserved in the consent record. Only
 * required purposes force re-accept.
 */
export async function hasActiveConsents(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  patientId: string,
): Promise<boolean> {
  const { data: consents } = await supabase
    .from("consents")
    .select("purpose, action, consent_version, occurred_at")
    .eq("patient_id", patientId)
    .in("purpose", REQUIRED_CONSENT_PURPOSES as unknown as string[])
    .order("occurred_at", { ascending: false })

  if (!consents || consents.length === 0) return false

  // Get the latest record for each purpose
  const latestByPurpose = new Map<
    string,
    { action: string; consent_version: string }
  >()
  for (const c of consents) {
    if (!latestByPurpose.has(c.purpose)) {
      latestByPurpose.set(c.purpose, {
        action: c.action,
        consent_version: c.consent_version,
      })
    }
  }

  // All required purposes must have:
  // 1. Latest action = 'accept'
  // 2. consent_version = CURRENT_CONSENT_VERSION
  return REQUIRED_CONSENT_PURPOSES.every((p) => {
    const latest = latestByPurpose.get(p)
    if (!latest) return false
    if (latest.action !== "accept") return false
    if (latest.consent_version !== CURRENT_CONSENT_VERSION) return false
    return true
  })
}
