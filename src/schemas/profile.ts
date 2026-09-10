import { z } from "zod/v4"

/**
 * CRP format validation: CRP XX/XXXXX
 * Where XX is the region (01-24) and XXXXX is the registration number.
 */
const CRP_REGEX = /^CRP\s?\d{2}\/\d{4,6}$/i

/**
 * Validates CPF check digits (mod 11 algorithm).
 */
function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "")
  if (digits.length !== 11) return false

  // Reject known invalid patterns
  if (/^(\d)\1{10}$/.test(digits)) return false

  // First check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(digits[9])) return false

  // Second check digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(digits[10])) return false

  return true
}

/**
 * Form input type — used by react-hook-form.
 * No transforms; validation only.
 */
export const onboardingFormSchema = z.object({
  full_name: z.string().min(3, "Nome deve ter no minimo 3 caracteres"),
  crp: z
    .string()
    .regex(CRP_REGEX, "Formato invalido. Use: CRP XX/XXXXX"),
  cpf: z
    .string()
    .min(11, "CPF deve ter 11 digitos")
    .refine((val) => {
      const digits = val.replace(/\D/g, "")
      return digits.length === 11
    }, "CPF deve ter 11 digitos")
    .refine((val) => isValidCpf(val), "CPF invalido"),
  phone: z
    .string()
    .min(10, "Telefone deve ter no minimo 10 digitos"),
  email: z.email("E-mail invalido"),
  specialty: z.string().optional(),
  default_session_value: z
    .number({ error: "Valor deve ser numerico" })
    .positive("Valor deve ser positivo"),
  cancellation_policy_hours: z
    .number()
    .int()
    .min(0, "Valor invalido"),
})

export type OnboardingFormInput = z.infer<typeof onboardingFormSchema>

/**
 * Server-side schema with transforms for data normalization.
 */
export const onboardingSchema = z.object({
  full_name: z.string().min(3, "Nome deve ter no minimo 3 caracteres"),
  crp: z
    .string()
    .regex(CRP_REGEX, "Formato invalido. Use: CRP XX/XXXXX"),
  cpf: z
    .string()
    .transform((val) => val.replace(/\D/g, ""))
    .refine((val) => val.length === 11, "CPF deve ter 11 digitos")
    .refine(isValidCpf, "CPF invalido"),
  phone: z
    .string()
    .min(10, "Telefone deve ter no minimo 10 digitos")
    .transform((val) => val.replace(/\D/g, "")),
  email: z.email("E-mail invalido"),
  specialty: z.string().optional(),
  default_session_value: z
    .number({ error: "Valor deve ser numerico" })
    .positive("Valor deve ser positivo"),
  cancellation_policy_hours: z
    .number()
    .int()
    .min(0, "Valor invalido")
    .default(24),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>

export const profileUpdateSchema = onboardingSchema
