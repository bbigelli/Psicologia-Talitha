import { describe, it, expect } from "vitest"
import { encrypt, decrypt } from "@/lib/crypto/envelope"

// Keys are loaded from env at module init — set them before import
// vitest.config.ts should have env loading or we rely on .env.local
// For CI, set RECORD_ENCRYPTION_KEK_V1 and CPF_INDEX_KEY in env

describe("envelope encryption — AES-256-GCM", () => {
  const PATIENT_ID = "550e8400-e29b-41d4-a716-446655440001"
  const RECORD_ID = "550e8400-e29b-41d4-a716-446655440002"
  const PLAINTEXT = "Patient presents with anxiety symptoms. Recommended CBT approach."

  it("encrypts and decrypts successfully with correct AAD", () => {
    const envelope = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)

    // Verify envelope structure
    expect(envelope.contentCiphertext).toBeTruthy()
    expect(envelope.contentIv).toBeTruthy()
    expect(envelope.contentTag).toBeTruthy()
    expect(envelope.dekWrapped).toBeTruthy()
    expect(envelope.dekIv).toBeTruthy()
    expect(envelope.dekTag).toBeTruthy()
    expect(envelope.kekVersion).toBe(1)

    // Ciphertext should be different from plaintext
    expect(envelope.contentCiphertext).not.toBe(PLAINTEXT)

    // Decrypt and verify roundtrip
    const decrypted = decrypt(envelope, PATIENT_ID, RECORD_ID)
    expect(decrypted).toBe(PLAINTEXT)
  })

  it("fails decryption with wrong patient_id (AAD mismatch)", () => {
    const envelope = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
    const WRONG_PATIENT = "550e8400-e29b-41d4-a716-446655440099"

    // Wrong AAD should cause GCM authentication failure
    expect(() => {
      decrypt(envelope, WRONG_PATIENT, RECORD_ID)
    }).toThrow()
  })

  it("fails decryption with wrong context_id (AAD mismatch)", () => {
    const envelope = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
    const WRONG_CONTEXT = "cpf" // different from RECORD_ID

    expect(() => {
      decrypt(envelope, PATIENT_ID, WRONG_CONTEXT)
    }).toThrow()
  })

  it("produces different ciphertexts for the same plaintext (random DEK + IV)", () => {
    const envelope1 = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)
    const envelope2 = encrypt(PLAINTEXT, PATIENT_ID, RECORD_ID)

    // Each encryption uses a random DEK and IV, so ciphertexts differ
    expect(envelope1.contentCiphertext).not.toBe(envelope2.contentCiphertext)
    expect(envelope1.contentIv).not.toBe(envelope2.contentIv)
    expect(envelope1.dekWrapped).not.toBe(envelope2.dekWrapped)
  })

  it("handles empty string", () => {
    const envelope = encrypt("", PATIENT_ID, RECORD_ID)
    const decrypted = decrypt(envelope, PATIENT_ID, RECORD_ID)
    expect(decrypted).toBe("")
  })

  it("handles unicode content", () => {
    const unicodeText = "Paciente relata melhora significativa. Avaliacao com escala Beck-II."
    const envelope = encrypt(unicodeText, PATIENT_ID, RECORD_ID)
    const decrypted = decrypt(envelope, PATIENT_ID, RECORD_ID)
    expect(decrypted).toBe(unicodeText)
  })
})
