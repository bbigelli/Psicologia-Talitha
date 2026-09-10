import { z } from "zod/v4"

/**
 * Charge and subscription schemas — validation for financial operations.
 *
 * @see data-architecture.md §charges, §subscriptions
 * @see architecture.md §8.1
 */

/** Charge statuses — matches CHECK constraint in `charges` table */
export const CHARGE_STATUSES = [
  "pending_creation",
  "pending",
  "overdue",
  "paid",
  "refunded",
  "chargeback",
  "cancelled",
] as const

export type ChargeStatus = (typeof CHARGE_STATUSES)[number]

/** Payment methods accepted by Asaas */
export const PAYMENT_METHODS = ["pix", "boleto", "credit_card"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Subscription statuses */
export const SUBSCRIPTION_STATUSES = [
  "active",
  "paused",
  "cancelled",
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/**
 * Create charge schema (form input).
 *
 * patient_id from the select — psychologist_id derived from getUser().
 * description is optional — the Asaas description is always neutral.
 */
export const createChargeSchema = z.object({
  patient_id: z.uuid("Paciente invalido"),
  payment_method: z.enum(PAYMENT_METHODS, {
    error: "Forma de pagamento invalida",
  }),
  amount: z
    .number({ error: "Valor invalido" })
    .positive("Valor deve ser positivo"),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida. Use AAAA-MM-DD")
    .refine(
      (d) => new Date(d + "T23:59:59") > new Date(),
      "Data de vencimento deve ser futura",
    ),
  description: z
    .string()
    .max(200, "Descricao deve ter no maximo 200 caracteres")
    .optional(),
  session_id: z.uuid("Sessao invalida").optional(),
})

export type CreateChargeInput = z.infer<typeof createChargeSchema>

/**
 * Create subscription schema.
 *
 * billing_day limited to 1-28 (avoids month-end edge cases).
 */
export const createSubscriptionSchema = z.object({
  patient_id: z.uuid("Paciente invalido"),
  payment_method: z.enum(PAYMENT_METHODS, {
    error: "Forma de pagamento invalida",
  }),
  monthly_value: z
    .number({ error: "Valor invalido" })
    .positive("Valor deve ser positivo"),
  billing_day: z
    .number({ error: "Dia de vencimento invalido" })
    .int()
    .min(1, "Dia deve ser entre 1 e 28")
    .max(28, "Dia deve ser entre 1 e 28"),
  sessions_per_cycle: z
    .number({ error: "Numero de sessoes invalido" })
    .int()
    .positive("Numero de sessoes deve ser positivo"),
})

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>

/**
 * Human-readable labels for charge statuses (pt-BR).
 */
export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  pending_creation: "Processando",
  pending: "Pendente",
  overdue: "Vencida",
  paid: "Pago",
  refunded: "Reembolsado",
  chargeback: "Estornado",
  cancelled: "Cancelado",
}

/**
 * Human-readable labels for payment methods (pt-BR).
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  boleto: "Boleto",
  credit_card: "Cartao",
}
