import { z } from "zod/v4"

/**
 * Validates a Brazilian CPF (digits only).
 * Checks format (11 digits), known-invalid patterns, and mod-11 check digits.
 */
function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "")
  if (digits.length !== 11) return false

  // Known-invalid patterns (all same digit)
  if (/^(\d)\1{10}$/.test(digits)) return false

  // First check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i)
  }
  let check = 11 - (sum % 11)
  if (check >= 10) check = 0
  if (check !== parseInt(digits[9], 10)) return false

  // Second check digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i)
  }
  check = 11 - (sum % 11)
  if (check >= 10) check = 0
  if (check !== parseInt(digits[10], 10)) return false

  return true
}

/**
 * Strip CPF to digits only, for consistent storage and HMAC.
 */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "")
}

/**
 * Format CPF for display: •••.•••.XXX-YY (last 5 digits visible).
 */
export function maskCpf(cpfDigits: string): string {
  const d = cpfDigits.replace(/\D/g, "")
  if (d.length !== 11) return "•••.•••.•••-••"
  return `•••.•••.${d.slice(6, 9)}-${d.slice(9)}`
}

/**
 * Check if a date of birth represents someone at least 18 years old.
 */
function isAtLeast18(dateOfBirth: Date): boolean {
  const today = new Date()
  const eighteenYearsAgo = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
  )
  return dateOfBirth <= eighteenYearsAgo
}

export const createPatientSchema = z.object({
  full_name: z
    .string()
    .min(3, "Nome deve ter no minimo 3 caracteres")
    .max(200, "Nome deve ter no maximo 200 caracteres"),
  email: z.email("E-mail invalido"),
  phone: z
    .string()
    .min(10, "Telefone deve ter no minimo 10 digitos")
    .max(15, "Telefone deve ter no maximo 15 digitos")
    .regex(/^[\d()+\-\s]+$/, "Formato de telefone invalido")
    .optional()
    .or(z.literal("")),
  cpf: z
    .string()
    .min(11, "CPF deve ter 11 digitos")
    .max(14, "CPF invalido")
    .refine((val) => isValidCpf(val), { message: "CPF invalido" }),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento invalida")
    .refine(
      (val) => {
        const date = new Date(val + "T00:00:00")
        return !isNaN(date.getTime())
      },
      { message: "Data de nascimento invalida" },
    )
    .refine(
      (val) => {
        const date = new Date(val + "T00:00:00")
        return isAtLeast18(date)
      },
      {
        message:
          "A pratica atende exclusivamente pacientes maiores de 18 anos. Nao e possivel cadastrar menores de idade.",
      },
    ),
})

export type CreatePatientInput = z.infer<typeof createPatientSchema>
