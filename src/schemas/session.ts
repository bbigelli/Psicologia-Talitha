import { z } from "zod/v4"

/**
 * Session schemas — validation for schedule operations.
 *
 * @see data-architecture.md §sessions
 * @see architecture.md §6, §18 requirement 5-6
 */

/** Valid session statuses — matches CHECK constraint in `sessions` table */
export const SESSION_STATUSES = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const

export type SessionStatus = (typeof SESSION_STATUSES)[number]

/** Valid payment statuses */
export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "overdue",
  "refunded",
  "waived",
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** Valid cancelled_by values */
export const CANCELLED_BY = ["psychologist", "patient", "system"] as const

/**
 * Create session schema (form input).
 *
 * patient_id comes from the select — not from URL or free text.
 * Psychologist ID is derived from getUser() in the server action.
 */
export const createSessionSchema = z.object({
  patient_id: z.uuid("Paciente invalido"),
  day_of_week: z
    .number()
    .int()
    .min(0, "Dia invalido")
    .max(6, "Dia invalido"),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Horario invalido. Use HH:MM"),
  duration_minutes: z
    .number()
    .int()
    .min(15, "Duracao minima: 15 minutos")
    .max(180, "Duracao maxima: 180 minutos")
    .default(50),
  is_recurring: z.boolean().default(false),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida. Use AAAA-MM-DD"),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>

/**
 * Cancel session schema.
 *
 * DoD-2: cancellation_reason validated — max 500 chars,
 * content sanitized at the action level.
 */
export const cancelSessionSchema = z.object({
  session_id: z.uuid("Sessao invalida"),
  reason: z
    .string()
    .max(500, "Motivo deve ter no maximo 500 caracteres")
    .optional(),
})

export type CancelSessionInput = z.infer<typeof cancelSessionSchema>

/**
 * Reschedule session schema.
 */
export const rescheduleSessionSchema = z.object({
  session_id: z.uuid("Sessao invalida"),
  new_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida. Use AAAA-MM-DD"),
  new_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Horario invalido. Use HH:MM"),
})

export type RescheduleSessionInput = z.infer<typeof rescheduleSessionSchema>

/**
 * Confirm attendance schema — used by the public action from email link.
 */
export const confirmAttendanceSchema = z.object({
  token: z.string().min(1, "Token obrigatorio"),
})

export type ConfirmAttendanceInput = z.infer<typeof confirmAttendanceSchema>

/**
 * Sanitize cancellation reason — DoD-2 requirement.
 *
 * Truncates to 500 chars. Does not attempt to detect clinical content
 * (that's a human responsibility), but strips HTML/script tags.
 */
export function sanitizeCancellationReason(reason: string): string {
  return reason
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/[<>]/g, "") // strip leftover angle brackets
    .slice(0, 500)
    .trim()
}
