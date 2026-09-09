/**
 * Logger tests — allowlist enforcement and safe error classification.
 *
 * Verifies that:
 * 1. Keys outside the allowlist are silently DROPPED (never logged)
 * 2. safeErrorCode() returns generic categories, never the original message
 *
 * These are critical for a clinical data system: logging CPF, clinical
 * content, tokens, or webhook payloads is a data breach.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { logInfo, logWarn, logError, safeErrorCode } from "@/lib/logger"

describe("logger — allowlist enforcement", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should include allowed keys in structured log output", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})

    logInfo({
      event_type: "test_event",
      action: "test_action",
      user_id: "u-123",
      patient_id: "p-456",
      session_id: "s-789",
      status: "success",
      error_code: "NONE",
      payment_id: "pay-000",
      message: "test message",
    })

    expect(spy).toHaveBeenCalledOnce()
    const logged = JSON.parse(spy.mock.calls[0][0] as string)
    expect(logged.event_type).toBe("test_event")
    expect(logged.action).toBe("test_action")
    expect(logged.user_id).toBe("u-123")
    expect(logged.patient_id).toBe("p-456")
    expect(logged.session_id).toBe("s-789")
    expect(logged.status).toBe("success")
    expect(logged.error_code).toBe("NONE")
    expect(logged.payment_id).toBe("pay-000")
    expect(logged.message).toBe("test message")
    expect(logged.level).toBe("info")
    expect(logged.timestamp).toBeDefined()
  })

  it("should silently DROP keys not in the allowlist", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})

    logInfo({
      event_type: "test",
      // All of these MUST be silently dropped:
      cpf: "12345678901",
      clinical_content: "Patient reports suicidal ideation",
      password: "abc123",
      webhook_payload: '{"payment":{"id":"pay_xxx"}}',
      token: "eyJhbGciOiJIUzI1NiJ9.fake",
      kek: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      email_body: "Lembrete de sessao",
      query: "SELECT * FROM patients",
    } as Record<string, unknown>)

    const logged = JSON.parse(spy.mock.calls[0][0] as string)
    // Allowed key present
    expect(logged.event_type).toBe("test")
    // ALL sensitive keys must be absent
    expect(logged.cpf).toBeUndefined()
    expect(logged.clinical_content).toBeUndefined()
    expect(logged.password).toBeUndefined()
    expect(logged.webhook_payload).toBeUndefined()
    expect(logged.token).toBeUndefined()
    expect(logged.kek).toBeUndefined()
    expect(logged.email_body).toBeUndefined()
    expect(logged.query).toBeUndefined()
  })

  it("should add timestamp automatically to every log entry", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})

    logWarn({ event_type: "timestamp_test" })

    const logged = JSON.parse(spy.mock.calls[0][0] as string)
    expect(logged.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("should set correct level for each log function", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    logInfo({ event_type: "i" })
    logWarn({ event_type: "w" })
    logError({ event_type: "e" })

    expect(JSON.parse(infoSpy.mock.calls[0][0] as string).level).toBe("info")
    expect(JSON.parse(warnSpy.mock.calls[0][0] as string).level).toBe("warn")
    expect(JSON.parse(errorSpy.mock.calls[0][0] as string).level).toBe("error")
  })

  it("should output valid JSON (parseable by log aggregators)", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})

    logInfo({ event_type: "json_test", action: "verify" })

    const raw = spy.mock.calls[0][0] as string
    expect(() => JSON.parse(raw)).not.toThrow()
  })
})

describe("safeErrorCode — classification without information leakage", () => {
  it("should return UNKNOWN_ERROR for non-Error values", () => {
    expect(safeErrorCode("string error")).toBe("UNKNOWN_ERROR")
    expect(safeErrorCode(42)).toBe("UNKNOWN_ERROR")
    expect(safeErrorCode(null)).toBe("UNKNOWN_ERROR")
    expect(safeErrorCode(undefined)).toBe("UNKNOWN_ERROR")
    expect(safeErrorCode({})).toBe("UNKNOWN_ERROR")
  })

  it("should classify network errors correctly", () => {
    expect(safeErrorCode(new Error("Connection timeout after 30s"))).toBe(
      "NETWORK_ERROR",
    )
    expect(safeErrorCode(new Error("ECONNREFUSED 127.0.0.1:5432"))).toBe(
      "NETWORK_ERROR",
    )
  })

  it("should classify auth/permission errors correctly", () => {
    expect(
      safeErrorCode(new Error("Permission denied for table patients")),
    ).toBe("AUTH_ERROR")
    expect(safeErrorCode(new Error("Unauthorized access attempt"))).toBe(
      "AUTH_ERROR",
    )
  })

  it("should classify duplicate/unique constraint errors", () => {
    expect(
      safeErrorCode(
        new Error("duplicate key value violates unique constraint"),
      ),
    ).toBe("DUPLICATE_ERROR")
    expect(safeErrorCode(new Error("unique violation on email"))).toBe(
      "DUPLICATE_ERROR",
    )
  })

  it("should classify not-found errors", () => {
    expect(safeErrorCode(new Error("No rows returned by query"))).toBe(
      "NOT_FOUND",
    )
    expect(safeErrorCode(new Error("Resource not found"))).toBe("NOT_FOUND")
  })

  it("should classify validation errors", () => {
    expect(safeErrorCode(new Error("Validation failed: email required"))).toBe(
      "VALIDATION_ERROR",
    )
    expect(safeErrorCode(new Error("Invalid input: CPF malformed"))).toBe(
      "VALIDATION_ERROR",
    )
  })

  it("should return INTERNAL_ERROR for unrecognized error messages", () => {
    expect(safeErrorCode(new Error("something completely random"))).toBe(
      "INTERNAL_ERROR",
    )
    expect(safeErrorCode(new Error("segfault in native module"))).toBe(
      "INTERNAL_ERROR",
    )
  })

  it("should NEVER return the original error message (no leakage)", () => {
    // These errors contain sensitive data that must never appear in the output
    const sensitiveErrors = [
      new Error(
        "SELECT content_ciphertext FROM clinical_records WHERE patient_id = 'abc'",
      ),
      new Error("CPF 12345678901 already registered in patients table"),
      new Error("Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature"),
      new Error(
        "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      ),
      new Error("Patient reports anxiety and depression symptoms"),
      new Error("Webhook payload: {asaas_payment_id: pay_123}"),
    ]

    const KNOWN_CODES = [
      "UNKNOWN_ERROR",
      "NETWORK_ERROR",
      "AUTH_ERROR",
      "DUPLICATE_ERROR",
      "NOT_FOUND",
      "VALIDATION_ERROR",
      "INTERNAL_ERROR",
    ]

    for (const err of sensitiveErrors) {
      const code = safeErrorCode(err)
      // Must be one of the known generic codes
      expect(KNOWN_CODES).toContain(code)
      // Must NOT contain any fragment of the original message
      expect(code).not.toContain("clinical")
      expect(code).not.toContain("12345678901")
      expect(code).not.toContain("eyJ")
      expect(code).not.toContain("SELECT")
      expect(code).not.toContain("anxiety")
      expect(code).not.toContain("payload")
      expect(code.length).toBeLessThan(30) // generic codes are short
    }
  })
})
