import { describe, it, expect, beforeEach } from "vitest"
import { randomBytes } from "node:crypto"

describe("keys.ts — key loading and validation", () => {
  // Generate fresh test-only keys — never use real keys from credentials
  const VALID_32_BYTE_KEY = Buffer.alloc(32, 0x01).toString("base64")
  const ANOTHER_32_BYTE_KEY = Buffer.alloc(32, 0x02).toString("base64")
  const SHORT_KEY = Buffer.alloc(16, 0x03).toString("base64") // 16 bytes, not 32

  beforeEach(() => {
    // Reset module registry to force re-evaluation of keys.ts
    // We need to set env vars before importing
    delete process.env.RECORD_ENCRYPTION_KEK_V1
    delete process.env.CPF_INDEX_KEY
  })

  it("throws when RECORD_ENCRYPTION_KEK_V1 is missing", async () => {
    process.env.CPF_INDEX_KEY = ANOTHER_32_BYTE_KEY
    // Do NOT set RECORD_ENCRYPTION_KEK_V1

    await expect(async () => {
      await import(`@/lib/crypto/keys?bust=${randomBytes(4).toString("hex")}-1`)
    }).rejects.toThrow("Missing RECORD_ENCRYPTION_KEK_V1")
  })

  it("throws when CPF_INDEX_KEY is missing", async () => {
    process.env.RECORD_ENCRYPTION_KEK_V1 = VALID_32_BYTE_KEY
    // Do NOT set CPF_INDEX_KEY

    await expect(async () => {
      await import(`@/lib/crypto/keys?bust=${randomBytes(4).toString("hex")}-2`)
    }).rejects.toThrow("Missing CPF_INDEX_KEY")
  })

  it("throws when key is too short (not 32 bytes)", async () => {
    process.env.RECORD_ENCRYPTION_KEK_V1 = SHORT_KEY
    process.env.CPF_INDEX_KEY = ANOTHER_32_BYTE_KEY

    await expect(async () => {
      await import(`@/lib/crypto/keys?bust=${randomBytes(4).toString("hex")}-3`)
    }).rejects.toThrow("must be exactly 32 bytes")
  })

  it("throws when key is not valid base64", async () => {
    process.env.RECORD_ENCRYPTION_KEK_V1 = "not-valid-base64!!!"
    process.env.CPF_INDEX_KEY = ANOTHER_32_BYTE_KEY

    // Note: Buffer.from with base64 doesn't throw for most inputs,
    // but the length check will catch invalid data
    await expect(async () => {
      await import(`@/lib/crypto/keys?bust=${randomBytes(4).toString("hex")}-4`)
    }).rejects.toThrow()
  })
})
