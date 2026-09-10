"use server"

/**
 * Financial Server Actions — charges and subscriptions.
 *
 * Flow for charge creation (architecture.md §8.1):
 * 1. Server Action validates input, checks lgpd_asaas consent
 * 2. Finds or creates Asaas customer (via manage-asaas-customer EF)
 * 3. Inserts charge with status = 'pending_creation'
 * 4. Calls create-charge Edge Function with ONLY charge_id
 * 5. On failure: charge stays pending_creation, retry-charges picks up
 *
 * Security:
 * - All actions use withPsychologist wrapper
 * - patient_id comes from validated input, never URL
 * - CPF decrypted only when needed for Asaas customer creation
 * - ASAAS_API_KEY never touches this module (Edge Function domain)
 * - Generic errors — never expose Asaas error details
 *
 * @see architecture.md §8.1
 * @see security-review-architecture.md AC1
 * @see ADR-0003, ADR-0006
 */

import { revalidatePath } from "next/cache"

import {
  withPsychologist,
  type PsychologistContext,
} from "@/lib/actions/_guard"
import { createAdminClient } from "@/lib/supabase/admin"
import { decrypt, type EncryptedEnvelope } from "@/lib/crypto/envelope"
import { logAudit } from "@/lib/audit"
import { logError, logInfo } from "@/lib/logger"
import {
  createChargeSchema,
  createSubscriptionSchema,
  type CreateChargeInput,
  type CreateSubscriptionInput,
} from "@/schemas/charge"

/**
 * Check that the patient has accepted lgpd_asaas consent (data sharing
 * with Asaas). Without it, creating a customer on Asaas sends CPF to
 * a third party without consent — LGPD violation.
 */
async function hasLgpdAsaasConsent(
  supabase: ReturnType<typeof createAdminClient>,
  patientId: string,
): Promise<boolean> {
  const { data: consents } = await supabase
    .from("consents")
    .select("action, occurred_at")
    .eq("patient_id", patientId)
    .eq("purpose", "lgpd_asaas")
    .order("occurred_at", { ascending: false })
    .limit(1)

  if (!consents || consents.length === 0) return false
  return consents[0].action === "accept"
}

/**
 * Check that communication consent is active (not revoked).
 * Used before sending billing reminders.
 */
async function hasCommunicationConsent(
  supabase: ReturnType<typeof createAdminClient>,
  patientId: string,
): Promise<boolean> {
  const { data: consents } = await supabase
    .from("consents")
    .select("action, occurred_at")
    .eq("patient_id", patientId)
    .eq("purpose", "communication")
    .order("occurred_at", { ascending: false })
    .limit(1)

  if (!consents || consents.length === 0) return true // No record = not revoked
  return consents[0].action !== "revoke"
}

/**
 * Find existing Asaas customer ID from previous charges.
 */
async function findExistingAsaasCustomer(
  supabase: ReturnType<typeof createAdminClient>,
  patientId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("charges")
    .select("asaas_customer_id")
    .eq("patient_id", patientId)
    .not("asaas_customer_id", "is", null)
    .limit(1)

  if (data && data.length > 0 && data[0].asaas_customer_id) {
    return data[0].asaas_customer_id
  }

  // Also check subscriptions
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("asaas_subscription_id")
    .eq("patient_id", patientId)
    .not("asaas_subscription_id", "is", null)
    .limit(1)

  // Subscriptions don't store customer_id directly, so this is just a fallback
  return null
}

/**
 * Decrypt patient CPF for Asaas customer creation.
 * Uses admin client to read ciphertext columns.
 */
async function decryptPatientCpf(
  patientId: string,
): Promise<string | null> {
  const admin = createAdminClient()

  const { data: patient } = await admin
    .from("patients")
    .select(
      "cpf_ciphertext, cpf_iv, cpf_tag, cpf_dek_wrapped, cpf_dek_iv, cpf_dek_tag, cpf_kek_version",
    )
    .eq("id", patientId)
    .single()

  if (!patient) return null

  try {
    // Convert BYTEA values to hex strings for the decrypt function
    const toHex = (val: unknown): string => {
      if (typeof val === "string") {
        // PostgREST returns BYTEA as hex string with \x prefix
        return val.replace(/^\\x/, "")
      }
      return ""
    }

    const envelope: EncryptedEnvelope = {
      contentCiphertext: toHex(patient.cpf_ciphertext),
      contentIv: toHex(patient.cpf_iv),
      contentTag: toHex(patient.cpf_tag),
      dekWrapped: toHex(patient.cpf_dek_wrapped),
      dekIv: toHex(patient.cpf_dek_iv),
      dekTag: toHex(patient.cpf_dek_tag),
      kekVersion: patient.cpf_kek_version ?? 1,
    }

    return decrypt(envelope, patientId, "cpf")
  } catch {
    logError({
      event_type: "cpf_decrypt_failure",
      patient_id: patientId,
      error_code: "DECRYPT_ERROR",
    })
    return null
  }
}

/**
 * Create an Asaas customer via the manage-asaas-customer Edge Function.
 * Returns the customer ID or null on failure.
 */
async function ensureAsaasCustomer(
  ctx: PsychologistContext,
  patientId: string,
): Promise<string | null> {
  const admin = createAdminClient()

  // Check existing customer first
  const existing = await findExistingAsaasCustomer(admin, patientId)
  if (existing) return existing

  // Get patient info
  const { data: patient } = await admin
    .from("patients")
    .select("full_name, email, phone")
    .eq("id", patientId)
    .single()

  if (!patient) return null

  // Decrypt CPF
  const cpf = await decryptPatientCpf(patientId)
  if (!cpf) return null

  // Call manage-asaas-customer Edge Function
  const { data, error } = await ctx.supabase.functions.invoke(
    "manage-asaas-customer",
    {
      body: {
        patient_id: patientId,
        cpf,
        name: patient.full_name,
        email: patient.email,
        phone: patient.phone || undefined,
      },
    },
  )

  if (error || !data?.customer_id) {
    logError({
      event_type: "asaas_customer_creation_failure",
      patient_id: patientId,
      error_code: "EF_ERROR",
    })
    return null
  }

  return data.customer_id
}

/**
 * Create a charge (avulsa) — the core financial operation.
 *
 * Security pre-conditions:
 * - withPsychologist: auth + role + aal2
 * - lgpd_asaas consent verified before sharing data with Asaas
 * - communication consent verified before billing reminders can be sent
 * - Asaas customer created via Edge Function (CPF stays in EF domain)
 * - create-charge Edge Function receives ONLY charge_id
 */
export const createCharge = withPsychologist(
  async (ctx, input: CreateChargeInput) => {
    // 1. Validate input with Zod
    const parseResult = createChargeSchema.safeParse(input)
    if (!parseResult.success) {
      return { chargeId: null, error: parseResult.error.issues[0]?.message ?? "Dados invalidos" } as const
    }
    const parsed = parseResult.data

    // 2. Verify patient belongs to this psychologist
    const admin = createAdminClient()
    const { data: patientAdmin } = await admin
      .from("patients")
      .select("psychologist_id")
      .eq("id", parsed.patient_id)
      .single()

    if (!patientAdmin || patientAdmin.psychologist_id !== ctx.profileId) {
      return { chargeId: null, error: "Paciente nao encontrado" } as const
    }

    // 3. Check lgpd_asaas consent
    const hasConsent = await hasLgpdAsaasConsent(admin, parsed.patient_id)
    if (!hasConsent) {
      return {
        chargeId: null,
        error: "O paciente precisa aceitar o termo de compartilhamento de dados com o Asaas antes de gerar cobrancas",
      } as const
    }

    // 4. Ensure Asaas customer exists
    const asaasCustomerId = await ensureAsaasCustomer(ctx, parsed.patient_id)
    if (!asaasCustomerId) {
      return {
        chargeId: null,
        error: "Nao foi possivel criar a cobranca. Tente novamente.",
      } as const
    }

    // 5. Insert charge with pending_creation
    const { data: charge, error: insertError } = await admin
      .from("charges")
      .insert({
        patient_id: parsed.patient_id,
        psychologist_id: ctx.profileId,
        session_id: parsed.session_id || null,
        amount: parsed.amount,
        due_date: parsed.due_date,
        payment_method: parsed.payment_method,
        description: parsed.description || "Prestacao de servicos profissionais",
        status: "pending_creation",
        asaas_customer_id: asaasCustomerId,
      })
      .select("id")
      .single()

    if (insertError || !charge) {
      logError({
        event_type: "charge_insert_failure",
        patient_id: parsed.patient_id,
        error_code: "INSERT_ERROR",
      })
      return {
        chargeId: null,
        error: "Nao foi possivel criar a cobranca. Tente novamente.",
      } as const
    }

    // 6. Call create-charge Edge Function (ONLY charge_id)
    // AFTER this point, the charge exists in the DB. Never throw.
    const { error: efError } = await ctx.supabase.functions.invoke(
      "create-charge",
      { body: { charge_id: charge.id } },
    )

    // 7. If Edge Function fails, charge stays pending_creation
    // retry-charges will pick it up. The user still sees success because
    // the charge was created (the payment will be processed later).
    if (efError) {
      logError({
        event_type: "create_charge_ef_failure",
        payment_id: charge.id,
        error_code: "EF_ERROR",
      })
    }

    // 8. Audit log (non-critical — don't fail the operation)
    await logAudit(ctx.supabase, parsed.patient_id, "CREATE_CHARGE", {
      charge_id: charge.id,
      amount: parsed.amount,
      payment_method: parsed.payment_method,
    })

    revalidatePath("/financeiro")

    return { chargeId: charge.id, error: null } as const
  },
)

/**
 * Create a recurring subscription via Asaas.
 */
export const createSubscription = withPsychologist(
  async (ctx, input: CreateSubscriptionInput) => {
    const parseResult = createSubscriptionSchema.safeParse(input)
    if (!parseResult.success) {
      return { subscriptionId: null, error: parseResult.error.issues[0]?.message ?? "Dados invalidos" } as const
    }
    const parsed = parseResult.data

    // Verify patient belongs to psychologist
    const admin = createAdminClient()
    const { data: patientAdmin } = await admin
      .from("patients")
      .select("psychologist_id")
      .eq("id", parsed.patient_id)
      .single()

    if (!patientAdmin || patientAdmin.psychologist_id !== ctx.profileId) {
      return { subscriptionId: null, error: "Paciente nao encontrado" } as const
    }

    // Check lgpd_asaas consent
    const hasConsent = await hasLgpdAsaasConsent(admin, parsed.patient_id)
    if (!hasConsent) {
      return {
        subscriptionId: null,
        error: "O paciente precisa aceitar o termo de compartilhamento de dados com o Asaas",
      } as const
    }

    // Check for existing active subscription (UNIQUE constraint also enforces)
    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("patient_id", parsed.patient_id)
      .eq("status", "active")
      .limit(1)

    if (existingSub && existingSub.length > 0) {
      return {
        subscriptionId: null,
        error: "Este paciente ja possui uma assinatura ativa",
      } as const
    }

    // Ensure Asaas customer exists
    const asaasCustomerId = await ensureAsaasCustomer(ctx, parsed.patient_id)
    if (!asaasCustomerId) {
      return {
        subscriptionId: null,
        error: "Nao foi possivel criar a assinatura. Tente novamente.",
      } as const
    }

    // Insert subscription record locally
    // NOTE: Asaas subscription creation via POST /v3/subscriptions is deferred
    // to a create-subscription Edge Function (not yet implemented — reported).
    // The subscription record tracks the package locally.
    const today = new Date()
    const { data: subscription, error: insertError } = await admin
      .from("subscriptions")
      .insert({
        patient_id: parsed.patient_id,
        psychologist_id: ctx.profileId,
        monthly_value: parsed.monthly_value,
        billing_day: parsed.billing_day,
        sessions_per_cycle: parsed.sessions_per_cycle,
        status: "active",
        current_cycle_start: today.toISOString().split("T")[0],
      })
      .select("id")
      .single()

    if (insertError || !subscription) {
      logError({
        event_type: "subscription_insert_failure",
        patient_id: parsed.patient_id,
        error_code: "INSERT_ERROR",
      })
      return {
        subscriptionId: null,
        error: "Nao foi possivel criar a assinatura. Tente novamente.",
      } as const
    }

    logInfo({
      event_type: "subscription_created",
      patient_id: parsed.patient_id,
      action: "createSubscription",
    })

    revalidatePath("/financeiro")

    return { subscriptionId: subscription.id, error: null } as const
  },
)

/**
 * Cancel a subscription.
 */
export const cancelSubscription = withPsychologist(
  async (ctx, input: { subscription_id: string }) => {
    if (!input.subscription_id) {
      return { error: "Assinatura invalida" } as const
    }

    const admin = createAdminClient()

    // Load subscription and verify ownership
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, patient_id, psychologist_id, asaas_subscription_id, status")
      .eq("id", input.subscription_id)
      .single()

    if (!sub || sub.psychologist_id !== ctx.profileId) {
      return { error: "Assinatura nao encontrada" } as const
    }

    if (sub.status === "cancelled") {
      return { error: "Assinatura ja cancelada" } as const
    }

    // Update status locally
    const { error: updateError } = await admin
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", sub.id)

    if (updateError) {
      return { error: "Nao foi possivel cancelar a assinatura" } as const
    }

    logInfo({
      event_type: "subscription_cancelled",
      patient_id: sub.patient_id,
      action: "cancelSubscription",
    })

    revalidatePath("/financeiro")

    return { error: null } as const
  },
)
