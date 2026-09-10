import { describe, it, expect } from "vitest"
import {
  encrypt,
  decrypt,
  hexToBytea,
  envelopeToBytea,
  type EncryptedEnvelope,
} from "@/lib/crypto/envelope"

/**
 * Round-trip tests for the BYTEA persistence path.
 *
 * The encrypt/decrypt functions operate on hex strings. When those hex
 * strings are written to Postgres BYTEA columns via PostgREST (Supabase),
 * they MUST be prefixed with `\x`. Without the prefix, PostgREST
 * interprets the hex characters as ASCII text, doubling the byte count
 * and silently corrupting the ciphertext. The corruption only surfaces
 * on decrypt ("Invalid authentication tag length").
 *
 * This test suite verifies:
 * 1. hexToBytea produces the correct format
 * 2. The round-trip (encrypt → hexToBytea → simulate DB → strip prefix → decrypt)
 *    works for both the profile path (psychologist CPF) and the patient path
 * 3. Hex without prefix produces data that CANNOT be decrypted (proves the
 *    bug that was caught)
 *
 * @see BLOCKER-1 from QA Sprint 3
 */

describe("BYTEA round-trip — hexToBytea", () => {
  const PROFILE_ID = "550e8400-e29b-41d4-a716-446655440001"
  const PATIENT_ID = "550e8400-e29b-41d4-a716-446655440002"
  const CPF = "12345678901"

  it("hexToBytea adds \\x prefix", () => {
    const hex = "48656c6c6f"
    const bytea = hexToBytea(hex)
    expect(bytea).toBe("\\x48656c6c6f")
  })

  it("hexToBytea handles empty string", () => {
    expect(hexToBytea("")).toBe("\\x")
  })

  it("envelopeToBytea converts all fields with prefix", () => {
    const envelope = encrypt(CPF, PROFILE_ID, "cpf")
    const bytea = envelopeToBytea(envelope, "cpf")

    // All BYTEA fields should start with \x
    expect((bytea.cpf_ciphertext as string).startsWith("\\x")).toBe(true)
    expect((bytea.cpf_iv as string).startsWith("\\x")).toBe(true)
    expect((bytea.cpf_tag as string).startsWith("\\x")).toBe(true)
    expect((bytea.cpf_dek_wrapped as string).startsWith("\\x")).toBe(true)
    expect((bytea.cpf_dek_iv as string).startsWith("\\x")).toBe(true)
    expect((bytea.cpf_dek_tag as string).startsWith("\\x")).toBe(true)
    expect(bytea.cpf_kek_version).toBe(1)
  })

  it("profile CPF round-trip: encrypt → hexToBytea → strip → decrypt", () => {
    // 1. Encrypt (what the action does)
    const envelope = encrypt(CPF, PROFILE_ID, "cpf")

    // 2. Convert to BYTEA format (what hexToBytea does before DB write)
    const byteaValues = {
      contentCiphertext: hexToBytea(envelope.contentCiphertext),
      contentIv: hexToBytea(envelope.contentIv),
      contentTag: hexToBytea(envelope.contentTag),
      dekWrapped: hexToBytea(envelope.dekWrapped),
      dekIv: hexToBytea(envelope.dekIv),
      dekTag: hexToBytea(envelope.dekTag),
      kekVersion: envelope.kekVersion,
    }

    // 3. Simulate what PostgREST returns on SELECT (strips \x prefix,
    //    returns raw hex). PostgREST returns BYTEA as hex without prefix.
    const fromDb: EncryptedEnvelope = {
      contentCiphertext: byteaValues.contentCiphertext.replace(/^\\x/, ""),
      contentIv: byteaValues.contentIv.replace(/^\\x/, ""),
      contentTag: byteaValues.contentTag.replace(/^\\x/, ""),
      dekWrapped: byteaValues.dekWrapped.replace(/^\\x/, ""),
      dekIv: byteaValues.dekIv.replace(/^\\x/, ""),
      dekTag: byteaValues.dekTag.replace(/^\\x/, ""),
      kekVersion: byteaValues.kekVersion,
    }

    // 4. Decrypt (what a future read action will do)
    const decrypted = decrypt(fromDb, PROFILE_ID, "cpf")
    expect(decrypted).toBe(CPF)
  })

  it("patient CPF round-trip: encrypt → hexToBytea → strip → decrypt", () => {
    const envelope = encrypt(CPF, PATIENT_ID, "cpf")

    const byteaValues = {
      contentCiphertext: hexToBytea(envelope.contentCiphertext),
      contentIv: hexToBytea(envelope.contentIv),
      contentTag: hexToBytea(envelope.contentTag),
      dekWrapped: hexToBytea(envelope.dekWrapped),
      dekIv: hexToBytea(envelope.dekIv),
      dekTag: hexToBytea(envelope.dekTag),
      kekVersion: envelope.kekVersion,
    }

    const fromDb: EncryptedEnvelope = {
      contentCiphertext: byteaValues.contentCiphertext.replace(/^\\x/, ""),
      contentIv: byteaValues.contentIv.replace(/^\\x/, ""),
      contentTag: byteaValues.contentTag.replace(/^\\x/, ""),
      dekWrapped: byteaValues.dekWrapped.replace(/^\\x/, ""),
      dekIv: byteaValues.dekIv.replace(/^\\x/, ""),
      dekTag: byteaValues.dekTag.replace(/^\\x/, ""),
      kekVersion: byteaValues.kekVersion,
    }

    const decrypted = decrypt(fromDb, PATIENT_ID, "cpf")
    expect(decrypted).toBe(CPF)
  })

  it("hex WITHOUT prefix corrupts data — decrypt fails", () => {
    // This test proves the bug: if hex is stored without \x prefix,
    // PostgREST interprets each hex char as an ASCII byte, doubling
    // the length. The decryption fails because the tag length is wrong.
    const envelope = encrypt(CPF, PROFILE_ID, "cpf")

    // Simulate what PostgREST would return if hex was stored as ASCII
    // text instead of binary. Each hex char becomes its ASCII code point.
    // The returned "hex" from PostgREST would be the hex-encoding of the
    // ASCII interpretation, which doubles the length.
    function asciiHex(hex: string): string {
      // Simulate: PostgREST stores "4a" as ASCII bytes 0x34 0x61,
      // then returns them as hex "3461". Each hex pair becomes 4 chars.
      return Buffer.from(hex, "ascii").toString("hex")
    }

    const corruptedEnvelope: EncryptedEnvelope = {
      contentCiphertext: asciiHex(envelope.contentCiphertext),
      contentIv: asciiHex(envelope.contentIv),
      contentTag: asciiHex(envelope.contentTag),
      dekWrapped: asciiHex(envelope.dekWrapped),
      dekIv: asciiHex(envelope.dekIv),
      dekTag: asciiHex(envelope.dekTag),
      kekVersion: envelope.kekVersion,
    }

    // Decryption MUST fail — the data is corrupted
    expect(() => {
      decrypt(corruptedEnvelope, PROFILE_ID, "cpf")
    }).toThrow()
  })
})
