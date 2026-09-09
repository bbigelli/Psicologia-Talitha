import { describe, it, expect, beforeEach, vi } from "vitest"

describe("keys.ts — key loading and validation", () => {
  // Test-only keys — deterministic, obviously fake, never from credentials
  const VALID_32_BYTE_KEY = Buffer.alloc(32, 0x01).toString("base64")
  const ANOTHER_32_BYTE_KEY = Buffer.alloc(32, 0x02).toString("base64")
  const SHORT_KEY = Buffer.alloc(16, 0x03).toString("base64") // 16 bytes, not 32

  beforeEach(() => {
    // Reset module registry so keys.ts is re-evaluated with fresh env state
    vi.resetModules()
    delete process.env.RECORD_ENCRYPTION_KEK_V1
    delete process.env.CPF_INDEX_KEY
  })

  it("throws when RECORD_ENCRYPTION_KEK_V1 is missing", async () => {
    process.env.CPF_INDEX_KEY = ANOTHER_32_BYTE_KEY
    // Do NOT set RECORD_ENCRYPTION_KEK_V1

    await expect(async () => {
      await import("@/lib/crypto/keys")
    }).rejects.toThrow("Missing RECORD_ENCRYPTION_KEK_V1")
  })

  it("throws when CPF_INDEX_KEY is missing", async () => {
    process.env.RECORD_ENCRYPTION_KEK_V1 = VALID_32_BYTE_KEY
    // Do NOT set CPF_INDEX_KEY

    await expect(async () => {
      await import("@/lib/crypto/keys")
    }).rejects.toThrow("Missing CPF_INDEX_KEY")
  })

  it("throws when key is too short (not 32 bytes)", async () => {
    process.env.RECORD_ENCRYPTION_KEK_V1 = SHORT_KEY
    process.env.CPF_INDEX_KEY = ANOTHER_32_BYTE_KEY

    await expect(async () => {
      await import("@/lib/crypto/keys")
    }).rejects.toThrow("must be exactly 32 bytes")
  })

  it("throws when key is not valid base64", async () => {
    process.env.RECORD_ENCRYPTION_KEK_V1 = "not-valid-base64!!!"
    process.env.CPF_INDEX_KEY = ANOTHER_32_BYTE_KEY

    // Buffer.from with base64 doesn't throw for most inputs,
    // but the length check will catch invalid data
    await expect(async () => {
      await import("@/lib/crypto/keys")
    }).rejects.toThrow()
  })
})
