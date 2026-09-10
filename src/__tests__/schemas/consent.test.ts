/**
 * Consent schema tests — Sprint 3.
 *
 * Validates zod schemas for consent acceptance and invite.
 *
 * Category: Small (pure validation, no I/O)
 */
import { describe, it, expect } from "vitest"
import {
  acceptConsentSchema,
  acceptMultipleConsentsSchema,
  inviteAcceptSchema,
  CONSENT_PURPOSES,
  CURRENT_CONSENT_VERSION,
} from "@/schemas/consent"

const VALID_HASH = "a".repeat(64) // 64-char hex

describe("acceptConsentSchema", () => {
  it("should accept valid consent input", () => {
    const result = acceptConsentSchema.safeParse({
      purpose: "online_therapy",
      consent_text_hash: VALID_HASH,
    })
    expect(result.success).toBe(true)
  })

  it("should accept all valid purposes", () => {
    for (const purpose of Object.values(CONSENT_PURPOSES)) {
      const result = acceptConsentSchema.safeParse({
        purpose,
        consent_text_hash: VALID_HASH,
      })
      expect(result.success, `purpose ${purpose} should be valid`).toBe(true)
    }
  })

  it("should reject invalid purpose", () => {
    const result = acceptConsentSchema.safeParse({
      purpose: "invalid_purpose",
      consent_text_hash: VALID_HASH,
    })
    expect(result.success).toBe(false)
  })

  it("should reject hash with wrong length", () => {
    const result = acceptConsentSchema.safeParse({
      purpose: "online_therapy",
      consent_text_hash: "abc123",
    })
    expect(result.success).toBe(false)
  })

  it("should reject missing hash", () => {
    const result = acceptConsentSchema.safeParse({
      purpose: "online_therapy",
    })
    expect(result.success).toBe(false)
  })
})

describe("acceptMultipleConsentsSchema", () => {
  it("should accept array of valid consents", () => {
    const result = acceptMultipleConsentsSchema.safeParse({
      consents: [
        { purpose: "lgpd_clinical", consent_text_hash: VALID_HASH },
        { purpose: "lgpd_asaas", consent_text_hash: VALID_HASH },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("should reject empty array", () => {
    const result = acceptMultipleConsentsSchema.safeParse({
      consents: [],
    })
    expect(result.success).toBe(false)
  })
})

describe("inviteAcceptSchema", () => {
  it("should accept valid password creation", () => {
    const result = inviteAcceptSchema.safeParse({
      token: "some-token-value",
      password: "SecurePass1",
      confirmPassword: "SecurePass1",
    })
    expect(result.success).toBe(true)
  })

  it("should reject password shorter than 10 chars", () => {
    const result = inviteAcceptSchema.safeParse({
      token: "some-token",
      password: "Short1",
      confirmPassword: "Short1",
    })
    expect(result.success).toBe(false)
  })

  it("should reject password without letter", () => {
    const result = inviteAcceptSchema.safeParse({
      token: "some-token",
      password: "1234567890",
      confirmPassword: "1234567890",
    })
    expect(result.success).toBe(false)
  })

  it("should reject password without number", () => {
    const result = inviteAcceptSchema.safeParse({
      token: "some-token",
      password: "AbcDefGhIjK",
      confirmPassword: "AbcDefGhIjK",
    })
    expect(result.success).toBe(false)
  })

  it("should reject mismatched passwords", () => {
    const result = inviteAcceptSchema.safeParse({
      token: "some-token",
      password: "SecurePass1",
      confirmPassword: "DifferentPass1",
    })
    expect(result.success).toBe(false)
  })

  it("should reject empty token", () => {
    const result = inviteAcceptSchema.safeParse({
      token: "",
      password: "SecurePass1",
      confirmPassword: "SecurePass1",
    })
    expect(result.success).toBe(false)
  })
})

describe("CONSENT_PURPOSES", () => {
  it("should have the 4 expected purposes", () => {
    expect(CONSENT_PURPOSES.ONLINE_THERAPY).toBe("online_therapy")
    expect(CONSENT_PURPOSES.LGPD_CLINICAL).toBe("lgpd_clinical")
    expect(CONSENT_PURPOSES.LGPD_ASAAS).toBe("lgpd_asaas")
    expect(CONSENT_PURPOSES.COMMUNICATION).toBe("communication")
    expect(Object.keys(CONSENT_PURPOSES)).toHaveLength(4)
  })
})

describe("CURRENT_CONSENT_VERSION", () => {
  it("should be a non-empty string", () => {
    expect(CURRENT_CONSENT_VERSION).toBeTruthy()
    expect(typeof CURRENT_CONSENT_VERSION).toBe("string")
  })
})
