/**
 * Tests for session schemas and sanitization.
 *
 * Validates:
 * - createSessionSchema validation
 * - cancelSessionSchema validation
 * - sanitizeCancellationReason (DoD-2)
 * - rescheduleSessionSchema validation
 *
 * @see schemas/session.ts
 * @see DoD-2 from Sprint 4
 */
import { describe, it, expect } from "vitest"
import {
  createSessionSchema,
  cancelSessionSchema,
  rescheduleSessionSchema,
  sanitizeCancellationReason,
} from "@/schemas/session"

describe("createSessionSchema", () => {
  const validInput = {
    patient_id: "550e8400-e29b-41d4-a716-446655440000",
    day_of_week: 1,
    time: "09:00",
    duration_minutes: 50,
    is_recurring: false,
    start_date: "2026-09-15",
  }

  it("accepts valid input", () => {
    const result = createSessionSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("rejects invalid patient_id", () => {
    const result = createSessionSchema.safeParse({
      ...validInput,
      patient_id: "not-a-uuid",
    })
    expect(result.success).toBe(false)
  })

  it("rejects day_of_week out of range", () => {
    const result = createSessionSchema.safeParse({
      ...validInput,
      day_of_week: 7,
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid time format", () => {
    const result = createSessionSchema.safeParse({
      ...validInput,
      time: "9:00",
    })
    expect(result.success).toBe(false)
  })

  it("accepts valid time format", () => {
    const result = createSessionSchema.safeParse({
      ...validInput,
      time: "14:30",
    })
    expect(result.success).toBe(true)
  })

  it("rejects duration below minimum", () => {
    const result = createSessionSchema.safeParse({
      ...validInput,
      duration_minutes: 10,
    })
    expect(result.success).toBe(false)
  })

  it("rejects duration above maximum", () => {
    const result = createSessionSchema.safeParse({
      ...validInput,
      duration_minutes: 200,
    })
    expect(result.success).toBe(false)
  })

  it("defaults duration to 50 when not provided", () => {
    const { duration_minutes: _, ...inputWithoutDuration } = validInput
    const result = createSessionSchema.safeParse(inputWithoutDuration)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.duration_minutes).toBe(50)
    }
  })

  it("rejects invalid start_date format", () => {
    const result = createSessionSchema.safeParse({
      ...validInput,
      start_date: "15/09/2026",
    })
    expect(result.success).toBe(false)
  })
})

describe("cancelSessionSchema", () => {
  it("accepts valid input with reason", () => {
    const result = cancelSessionSchema.safeParse({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      reason: "Paciente solicitou cancelamento",
    })
    expect(result.success).toBe(true)
  })

  it("accepts input without reason", () => {
    const result = cancelSessionSchema.safeParse({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
    })
    expect(result.success).toBe(true)
  })

  it("rejects reason longer than 500 chars", () => {
    const result = cancelSessionSchema.safeParse({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      reason: "a".repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid session_id", () => {
    const result = cancelSessionSchema.safeParse({
      session_id: "not-a-uuid",
    })
    expect(result.success).toBe(false)
  })
})

describe("rescheduleSessionSchema", () => {
  it("accepts valid input", () => {
    const result = rescheduleSessionSchema.safeParse({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      new_date: "2026-09-20",
      new_time: "15:00",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid date format", () => {
    const result = rescheduleSessionSchema.safeParse({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      new_date: "20/09/2026",
      new_time: "15:00",
    })
    expect(result.success).toBe(false)
  })
})

describe("sanitizeCancellationReason (DoD-2)", () => {
  it("passes through normal text", () => {
    const result = sanitizeCancellationReason("Paciente viajou")
    expect(result).toBe("Paciente viajou")
  })

  it("strips HTML tags", () => {
    const result = sanitizeCancellationReason(
      '<script>alert("xss")</script>Razao valida',
    )
    expect(result).not.toContain("<script>")
    expect(result).toContain("Razao valida")
  })

  it("strips angle brackets", () => {
    const result = sanitizeCancellationReason("text<>with>brackets")
    expect(result).not.toContain("<")
    expect(result).not.toContain(">")
  })

  it("truncates to 500 chars", () => {
    const longText = "a".repeat(600)
    const result = sanitizeCancellationReason(longText)
    expect(result.length).toBeLessThanOrEqual(500)
  })

  it("trims whitespace", () => {
    const result = sanitizeCancellationReason("  spaces  ")
    expect(result).toBe("spaces")
  })

  it("handles empty string", () => {
    const result = sanitizeCancellationReason("")
    expect(result).toBe("")
  })
})
