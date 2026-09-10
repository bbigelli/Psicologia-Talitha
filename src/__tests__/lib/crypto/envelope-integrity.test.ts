/**
 * Envelope encryption — integrity and edge cases.
 *
 * Extends the existing 6 tests in envelope.test.ts with cases that
 * prove GCM integrity guarantees: tampered ciphertext, tampered tags,
 * IV uniqueness, and corrupted DEK handling.
 *
 * These are the scenarios that matter for a clinical records system:
 * an attacker who modifies ciphertext at rest must be DETECTED, not
 * silently produce garbage plaintext.
 */
import { describe, it, expect } from "vitest"
import { encrypt, decrypt, type EncryptedEnvelope } from "@/lib/crypto/envelope"

describe("envelope encryption — GCM integrity guarantees", () => {
  const PATIENT_ID = "550e8400-e29b-41d4-a716-446655440001"
  const RECORD_ID = "550e8400-e29b-41d4-a716-446655440002"
  const PLAINTEXT = "Patient presents with moderate anxiety. CBT protocol initiated."

  describe("ciphertext tampering detection", () => {
    it("should reject decryption when content ciphertext has 1 byte flipped", () => {
      // Arrange
      const envelope = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
      const tampered = Buffer.from(envelope.contentCiphertext, "hex")
      tampered[0] ^= 0xff

      const tamperedEnvelope: EncryptedEnvelope = {
        ...envelope,
        contentCiphertext: tampered.toString("hex"),
      }

      // Act + Assert — GCM must reject, never return garbage
      expect(() => decrypt(tamperedEnvelope, PATIENT_ID, RECORD_ID)).toThrow()
    })

    it("should reject decryption when content GCM auth tag has 1 byte flipped", () => {
      const envelope = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
      const tampered = Buffer.from(envelope.contentTag, "hex")
      tampered[0] ^= 0xff

      const tamperedEnvelope: EncryptedEnvelope = {
        ...envelope,
        contentTag: tampered.toString("hex"),
      }

      expect(() => decrypt(tamperedEnvelope, PATIENT_ID, RECORD_ID)).toThrow()
    })

    it("should reject decryption when DEK wrapping auth tag is tampered", () => {
      const envelope = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
      const tampered = Buffer.from(envelope.dekTag, "hex")
      tampered[0] ^= 0xff

      const tamperedEnvelope: EncryptedEnvelope = {
        ...envelope,
        dekTag: tampered.toString("hex"),
      }

      expect(() => decrypt(tamperedEnvelope, PATIENT_ID, RECORD_ID)).toThrow()
    })

    it("should reject decryption when wrapped DEK bytes are tampered", () => {
      const envelope = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
      const tampered = Buffer.from(envelope.dekWrapped, "hex")
      tampered[0] ^= 0xff

      const tamperedEnvelope: EncryptedEnvelope = {
        ...envelope,
        dekWrapped: tampered.toString("hex"),
      }

      expect(() => decrypt(tamperedEnvelope, PATIENT_ID, RECORD_ID)).toThrow()
    })
  })

  describe("IV uniqueness per operation (GCM nonce reuse is catastrophic)", () => {
    it("should produce different content IVs for identical plaintext and AAD", () => {
      // Arrange — same plaintext, same owner, same context
      const a = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
      const b = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)

      // Assert — IVs must differ (randomBytes generates unique nonces)
      expect(a.contentIv).not.toBe(b.contentIv)
    })

    it("should produce different DEK wrapping IVs for identical plaintext", () => {
      const a = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
      const b = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)

      expect(a.dekIv).not.toBe(b.dekIv)
    })

    it("should produce unique IVs across 50 encryptions", () => {
      // GCM with 96-bit IV has a birthday collision bound at ~2^48 operations.
      // 50 is trivially below that, but this verifies the RNG is not degenerate.
      const ivs = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const env = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
        ivs.add(env.contentIv)
        ivs.add(env.dekIv)
      }
      // 50 encryptions = 50 content IVs + 50 DEK IVs = 100 unique values
      expect(ivs.size).toBe(100)
    })
  })

  describe("corrupted DEK handling", () => {
    it("should fail cleanly when DEK IV is replaced with wrong value", () => {
      const envelope = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
      const wrongIv = Buffer.alloc(12, 0x42).toString("hex")

      const corruptedEnvelope: EncryptedEnvelope = {
        ...envelope,
        dekIv: wrongIv,
      }

      expect(() => decrypt(corruptedEnvelope, PATIENT_ID, RECORD_ID)).toThrow()
    })

    it("should fail cleanly when content IV is replaced with wrong value", () => {
      const envelope = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
      const wrongIv = Buffer.alloc(12, 0x99).toString("hex")

      const corruptedEnvelope: EncryptedEnvelope = {
        ...envelope,
        contentIv: wrongIv,
      }

      expect(() => decrypt(corruptedEnvelope, PATIENT_ID, RECORD_ID)).toThrow()
    })
  })
})
