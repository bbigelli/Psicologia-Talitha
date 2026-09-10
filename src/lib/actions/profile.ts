"use server"

import { revalidatePath } from "next/cache"
import { withPsychologist } from "@/lib/actions/_guard"
import {
  onboardingSchema,
  type OnboardingFormInput,
} from "@/schemas/profile"
import { encrypt } from "@/lib/crypto/envelope"

/**
 * Complete onboarding — saves professional profile data.
 *
 * CPF is encrypted with envelope encryption (AAD = profileId|cpf).
 * No e-Psi field (removed by E5 — platform deactivated 2024-08-31).
 *
 * @see architecture.md §9, Emenda E5
 */
export const completeOnboarding = withPsychologist(
  async (ctx, input: OnboardingFormInput) => {
    const parsed = onboardingSchema.parse(input)

    // Extract CRP region from the full CRP string
    const crpMatch = parsed.crp.match(/CRP\s?(\d{2})\/(\d+)/i)
    const crpRegion = crpMatch ? crpMatch[1] : null
    const crpNumber = parsed.crp

    // Encrypt CPF with envelope encryption
    const cpfEnvelope = encrypt(parsed.cpf, ctx.profileId, "cpf")

    const { error } = await ctx.supabase
      .from("profiles")
      .update({
        full_name: parsed.full_name,
        crp: crpNumber,
        crp_region: crpRegion,
        phone: parsed.phone,
        email: parsed.email,
        specialty: parsed.specialty ?? null,
        default_session_value: parsed.default_session_value,
        cancellation_policy_hours: parsed.cancellation_policy_hours,
        cpf_ciphertext: cpfEnvelope.contentCiphertext,
        cpf_iv: cpfEnvelope.contentIv,
        cpf_tag: cpfEnvelope.contentTag,
        cpf_dek_wrapped: cpfEnvelope.dekWrapped,
        cpf_dek_iv: cpfEnvelope.dekIv,
        cpf_dek_tag: cpfEnvelope.dekTag,
        cpf_kek_version: cpfEnvelope.kekVersion,
        onboarding_completed: true,
      })
      .eq("id", ctx.profileId)

    if (error) {
      throw new Error("Nao foi possivel salvar o perfil")
    }

    revalidatePath("/onboarding")
    revalidatePath("/dashboard")
    revalidatePath("/perfil")

    return undefined
  },
)

/**
 * Update psychologist profile.
 */
export const updateProfile = withPsychologist(
  async (ctx, input: OnboardingFormInput) => {
    const parsed = onboardingSchema.parse(input)

    const crpMatch = parsed.crp.match(/CRP\s?(\d{2})\/(\d+)/i)
    const crpRegion = crpMatch ? crpMatch[1] : null

    // Re-encrypt CPF
    const cpfEnvelope = encrypt(parsed.cpf, ctx.profileId, "cpf")

    const { error } = await ctx.supabase
      .from("profiles")
      .update({
        full_name: parsed.full_name,
        crp: parsed.crp,
        crp_region: crpRegion,
        phone: parsed.phone,
        email: parsed.email,
        specialty: parsed.specialty ?? null,
        default_session_value: parsed.default_session_value,
        cancellation_policy_hours: parsed.cancellation_policy_hours,
        cpf_ciphertext: cpfEnvelope.contentCiphertext,
        cpf_iv: cpfEnvelope.contentIv,
        cpf_tag: cpfEnvelope.contentTag,
        cpf_dek_wrapped: cpfEnvelope.dekWrapped,
        cpf_dek_iv: cpfEnvelope.dekIv,
        cpf_dek_tag: cpfEnvelope.dekTag,
        cpf_kek_version: cpfEnvelope.kekVersion,
      })
      .eq("id", ctx.profileId)

    if (error) {
      throw new Error("Nao foi possivel atualizar o perfil")
    }

    revalidatePath("/perfil")

    return undefined
  },
)
