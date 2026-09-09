/**
 * Extended key validation tests for keys.ts.
 *
 * The existing keys.test.ts covers: missing KEK, missing CPF key,
 * too-short key (16 bytes), and invalid base64. This file adds:
 * - Key too long (64 bytes) — must be rejected
 * - Verification that keys are removed from process.env after loading
 */
import { describe, it, expect, beforeEach, vi } from "vitest"

describe("keys.ts — extended validation edge cases", () => {
  const VALID_32_BYTE_KEY = Buffer.alloc(32, 0x01).toString("base64")
  const KEY_64_BYTES = Buffer.alloc(64, 0x04).toString("base64")

  beforeEach(() => {
    vi.resetModules()
    delete process.env.RECORD_ENCRYPTION_KEK_V1
    delete process.env.CPF_INDEX_KEY
  })

  it("should reject KEK that is 64 bytes (too long)", async () => {
    // Arrange — 64-byte key is double the required 32 bytes
    process.env.RECORD_ENCRYPTION_KEK_V1 = KEY_64_BYTES
    process.env.CPF_INDEX_KEY = VALID_32_BYTE_KEY

    // Act + Assert
    await expect(async () => {
      await import("@/lib/crypto/keys")
    }).rejects.toThrow("must be exactly 32 bytes")
  })

  it("should reject CPF_INDEX_KEY that is 64 bytes (too long)", async () => {
    process.env.RECORD_ENCRYPTION_KEK_V1 = VALID_32_BYTE_KEY
    process.env.CPF_INDEX_KEY = KEY_64_BYTES

    await expect(async () => {
      await import("@/lib/crypto/keys")
    }).rejects.toThrow("must be exactly 32 bytes")
  })

  it("should delete keys from process.env after successful loading", async () => {
    // Arrange
    process.env.RECORD_ENCRYPTION_KEK_V1 = VALID_32_BYTE_KEY
    process.env.CPF_INDEX_KEY = VALID_32_BYTE_KEY

    // Act
    const mod = await import("@/lib/crypto/keys")

    // Assert — keys must be gone from process.env (defense-in-depth)
    expect(process.env.RECORD_ENCRYPTION_KEK_V1).toBeUndefined()
    expect(process.env.CPF_INDEX_KEY).toBeUndefined()
    // But the module exports the loaded buffers
    expect(mod.KEK).toBeInstanceOf(Buffer)
    expect(mod.CPF_INDEX_KEY).toBeInstanceOf(Buffer)
    expect(mod.KEK.length).toBe(32)
    expect(mod.CPF_INDEX_KEY.length).toBe(32)
  })

  it("should reject empty string as KEK", async () => {
    process.env.RECORD_ENCRYPTION_KEK_V1 = ""
    process.env.CPF_INDEX_KEY = VALID_32_BYTE_KEY

    await expect(async () => {
      await import("@/lib/crypto/keys")
    }).rejects.toThrow("Missing RECORD_ENCRYPTION_KEK_V1")
  })
})
