"use server"

/**
 * Patient management Server Actions.
 *
 * IMPORTANT: The `patients` table has NO GRANT for INSERT/UPDATE/DELETE
 * to `authenticated`. All writes go through the admin client (service_role).
 * Authorization is 100% our responsibility — the admin client bypasses RLS.
 *
 * The admin client import is in the allowlist (architecture.md §6.2):
 * "Patient invite creation (auth.admin.createUser)"
 *
 * @see architecture.md §5.1, §9, §16
 * @see data-architecture.md patients table (no INSERT GRANT for authenticated)
 */

import { randomUUID, createHash } from "node:crypto"
import { revalidatePath } from "next/cache"

import { withPsychologist } from "@/lib/actions/_guard"
import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt, hexToBytea } from "@/lib/crypto/envelope"
import { computeCpfBlindIndex } from "@/lib/crypto/blind-index"
import {
  createPatientSchema,
  normalizeCpf,
  type CreatePatientInput,
} from "@/schemas/patient"
import { logAudit } from "@/lib/audit"
import { logError, logInfo } from "@/lib/logger"
import { sendEmail } from "@/lib/email/send"
import { buildInviteEmail } from "@/lib/email/templates"
import type { ActionResult } from "@/types/actions"

/** Token TTL for invite: 72 hours */
const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000

/** Max invite resends per patient per hour */
const MAX_RESEND_PER_HOUR = 3

/**
 * Hash a raw token for storage. Token is NEVER stored in plaintext.
 * Uses SHA-256.
 */
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

/**
 * Get the site URL for building invite links.
 */
function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
}

/**
 * Create a new patient with encrypted CPF + blind index.
 *
 * Flow:
 * 1. Validate input (zod) — age >= 18, CPF valid
 * 2. Generate patient UUID BEFORE encryption (AAD depends on it)
 * 3. Encrypt CPF with envelope (AAD = patient_id|'cpf')
 * 4. Compute HMAC blind index for duplicate detection
 * 5. Create auth user via admin (patient doesn't set password yet)
 * 6. Insert patient record via admin (no GRANT for authenticated)
 * 7. Create invite token (hash stored, raw sent in email)
 * 8. Send invite email via Resend
 * 9. Audit log
 *
 * If email sending fails, the patient IS created but with a toast
 * indicating the invite failed — resend from the list.
 */
export const createPatient = withPsychologist(
  async (ctx, input: CreatePatientInput) => {
    // 1. Validate input
    const parsed = createPatientSchema.parse(input)
    const cpfDigits = normalizeCpf(parsed.cpf)

    // 2. Generate patient UUID BEFORE encrypting (AAD needs it)
    const patientId = randomUUID()

    // 3. Encrypt CPF with envelope encryption
    const cpfEnvelope = encrypt(cpfDigits, patientId, "cpf")

    // 4. Compute blind index for duplicate CPF detection
    const cpfHmac = computeCpfBlindIndex(cpfDigits)

    // 5. Use admin client for all writes (no GRANT for authenticated on patients)
    const adminClient = createAdminClient()

    // Check for duplicate CPF via blind index
    const { data: existingCpf } = await adminClient
      .from("patients")
      .select("id")
      .eq("cpf_hmac", cpfHmac)
      .maybeSingle()

    if (existingCpf) {
      return { emailSent: false, error: "CPF ja cadastrado" } as const
    }

    // Check for duplicate email
    const { data: existingEmail } = await adminClient
      .from("patients")
      .select("id")
      .eq("email", parsed.email)
      .maybeSingle()

    if (existingEmail) {
      return { emailSent: false, error: "E-mail ja cadastrado" } as const
    }

    // 6. Create auth user (email confirmed, no password yet — patient sets it via invite)
    const { data: authUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: parsed.email,
        email_confirm: true,
        app_metadata: { role: "patient" },
        user_metadata: { full_name: parsed.full_name },
      })

    if (authError) {
      logError({
        event_type: "patient_creation_failure",
        action: "createPatient",
        error_code: "AUTH_CREATE_FAILED",
      })
      throw new Error("Nao foi possivel criar a conta do paciente")
    }

    // Create profile for the patient user
    const { error: profileError } = await adminClient
      .from("profiles")
      .insert({
        id: authUser.user.id,
        role: "patient",
        full_name: parsed.full_name,
        email: parsed.email,
        phone: parsed.phone || null,
      })

    if (profileError) {
      // Cleanup: delete auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      logError({
        event_type: "patient_creation_failure",
        action: "createPatient",
        error_code: "PROFILE_CREATE_FAILED",
      })
      throw new Error("Nao foi possivel criar o perfil do paciente")
    }

    // 7. Insert patient record with encrypted CPF
    // Convert hex strings to \x prefixed format for BYTEA columns
    const { error: patientError } = await adminClient
      .from("patients")
      .insert({
        id: patientId,
        user_id: authUser.user.id,
        psychologist_id: ctx.profileId,
        full_name: parsed.full_name,
        email: parsed.email,
        phone: parsed.phone || null,
        date_of_birth: parsed.date_of_birth,
        cpf_ciphertext: hexToBytea(cpfEnvelope.contentCiphertext),
        cpf_iv: hexToBytea(cpfEnvelope.contentIv),
        cpf_tag: hexToBytea(cpfEnvelope.contentTag),
        cpf_dek_wrapped: hexToBytea(cpfEnvelope.dekWrapped),
        cpf_dek_iv: hexToBytea(cpfEnvelope.dekIv),
        cpf_dek_tag: hexToBytea(cpfEnvelope.dekTag),
        cpf_kek_version: cpfEnvelope.kekVersion,
        cpf_hmac: cpfHmac,
        status: "invited",
      })

    if (patientError) {
      // Cleanup: delete auth user and profile if patient creation fails
      await adminClient.from("profiles").delete().eq("id", authUser.user.id)
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      logError({
        event_type: "patient_creation_failure",
        action: "createPatient",
        error_code: "PATIENT_INSERT_FAILED",
      })
      throw new Error("Nao foi possivel cadastrar o paciente")
    }

    // 8. Create invite token
    const rawToken = randomUUID() + randomUUID() // >= 128 bits
    const tokenHash = hashToken(rawToken)

    const { error: tokenError } = await adminClient
      .from("email_action_tokens")
      .insert({
        token_hash: tokenHash,
        purpose: "invite",
        patient_id: patientId,
        expires_at: new Date(
          Date.now() + INVITE_TOKEN_TTL_MS,
        ).toISOString(),
      })

    if (tokenError) {
      logError({
        event_type: "token_creation_failure",
        action: "createPatient",
        error_code: "TOKEN_INSERT_FAILED",
      })
      // Patient created but token failed — they can resend from the list
    }

    // 9. Send invite email
    let emailSent = false
    if (!tokenError) {
      // Get psychologist name for the email
      const { data: psychProfile } = await ctx.supabase
        .from("profiles")
        .select("full_name")
        .eq("id", ctx.profileId)
        .single()

      const inviteUrl = `${getSiteUrl()}/convite/${rawToken}`

      const emailContent = buildInviteEmail({
        patientName: parsed.full_name,
        inviteUrl,
        psychologistName: psychProfile?.full_name || "Sua profissional",
      })

      emailSent = await sendEmail({
        to: parsed.email,
        ...emailContent,
      })
    }

    // 10. Audit log
    await logAudit(ctx.supabase, patientId, "CREATE_PATIENT")

    logInfo({
      event_type: "patient_created",
      action: "CREATE_PATIENT",
      patient_id: patientId,
    })

    revalidatePath("/pacientes")

    return { patientId, emailSent } as const
  },
)

/**
 * Resend invite email to a patient.
 *
 * Rate limited: max 3 per patient per hour (architecture.md §18 req 7).
 */
export const resendInvite = withPsychologist(
  async (ctx, input: { patientId: string }) => {
    const adminClient = createAdminClient()

    // Verify this patient belongs to this psychologist
    const { data: patient } = await adminClient
      .from("patients")
      .select(
        "id, full_name, email, status, psychologist_id",
      )
      .eq("id", input.patientId)
      .single()

    if (!patient || patient.psychologist_id !== ctx.profileId) {
      throw new Error("Paciente nao encontrado")
    }

    if (patient.status !== "invited") {
      throw new Error("Paciente ja ativou a conta")
    }

    // Rate limit check: count tokens created in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await adminClient
      .from("email_action_tokens")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", input.patientId)
      .eq("purpose", "invite")
      .gte("created_at", oneHourAgo)

    if ((count ?? 0) >= MAX_RESEND_PER_HOUR) {
      throw new Error(
        "Limite de reenvios atingido. Aguarde 1 hora para tentar novamente.",
      )
    }

    // Create new invite token
    const rawToken = randomUUID() + randomUUID()
    const tokenHash = hashToken(rawToken)

    const { error: tokenError } = await adminClient
      .from("email_action_tokens")
      .insert({
        token_hash: tokenHash,
        purpose: "invite",
        patient_id: input.patientId,
        expires_at: new Date(
          Date.now() + INVITE_TOKEN_TTL_MS,
        ).toISOString(),
      })

    if (tokenError) {
      throw new Error("Nao foi possivel criar o convite")
    }

    // Get psychologist name
    const { data: psychProfile } = await ctx.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", ctx.profileId)
      .single()

    const inviteUrl = `${getSiteUrl()}/convite/${rawToken}`

    const emailContent = buildInviteEmail({
      patientName: patient.full_name,
      inviteUrl,
      psychologistName: psychProfile?.full_name || "Sua profissional",
    })

    const emailSent = await sendEmail({
      to: patient.email,
      ...emailContent,
    })

    if (!emailSent) {
      throw new Error("Nao foi possivel enviar o e-mail de convite")
    }

    logInfo({
      event_type: "invite_resent",
      action: "CREATE_PATIENT",
      patient_id: input.patientId,
    })

    return undefined
  },
)

