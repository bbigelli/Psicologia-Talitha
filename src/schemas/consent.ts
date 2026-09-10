import { z } from "zod/v4"

/**
 * Consent purposes — matches CHECK constraint in `consents` table.
 *
 * @see data-architecture.md §consents
 */
export const CONSENT_PURPOSES = {
  ONLINE_THERAPY: "online_therapy",
  LGPD_CLINICAL: "lgpd_clinical",
  LGPD_ASAAS: "lgpd_asaas",
  COMMUNICATION: "communication",
} as const

export type ConsentPurpose =
  (typeof CONSENT_PURPOSES)[keyof typeof CONSENT_PURPOSES]

/**
 * Re-export from the canonical module (zero dependencies).
 * @see src/lib/consent-version.ts
 */
export { CURRENT_CONSENT_VERSION } from "@/lib/consent-version"

export const acceptConsentSchema = z.object({
  purpose: z.enum([
    "online_therapy",
    "lgpd_clinical",
    "lgpd_asaas",
    "communication",
  ]),
  consent_text_hash: z.string().length(64, "Hash invalido"),
})

export type AcceptConsentInput = z.infer<typeof acceptConsentSchema>

export const acceptMultipleConsentsSchema = z.object({
  consents: z
    .array(acceptConsentSchema)
    .min(1, "Ao menos um consentimento e obrigatorio"),
})

export type AcceptMultipleConsentsInput = z.infer<
  typeof acceptMultipleConsentsSchema
>

export const revokeConsentSchema = z.object({
  purpose: z.enum([
    "online_therapy",
    "lgpd_clinical",
    "lgpd_asaas",
    "communication",
  ]),
})

export type RevokeConsentInput = z.infer<typeof revokeConsentSchema>

/**
 * Schema for invite acceptance (password creation).
 */
export const inviteAcceptSchema = z
  .object({
    token: z.string().min(1, "Token e obrigatorio"),
    password: z
      .string()
      .min(10, "A senha deve ter no minimo 10 caracteres")
      .regex(
        /[a-zA-Z]/,
        "A senha deve conter pelo menos uma letra",
      )
      .regex(
        /[0-9]/,
        "A senha deve conter pelo menos um numero",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao coincidem",
    path: ["confirmPassword"],
  })

export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>
