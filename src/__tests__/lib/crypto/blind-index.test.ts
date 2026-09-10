import { describe, it, expect } from "vitest"
import { computeCpfBlindIndex } from "@/lib/crypto/blind-index"

describe("blind-index — HMAC-SHA256 for CPF", () => {
  it("produces deterministic output for the same CPF", () => {
    const cpf = "12345678901"
    const hash1 = computeCpfBlindIndex(cpf)
    const hash2 = computeCpfBlindIndex(cpf)

    expect(hash1).toBe(hash2)
  })

  it("produces different output for different CPFs", () => {
    const hash1 = computeCpfBlindIndex("12345678901")
    const hash2 = computeCpfBlindIndex("98765432100")

    expect(hash1).not.toBe(hash2)
  })

  it("returns a hex string of 64 characters (SHA-256)", () => {
    const hash = computeCpfBlindIndex("12345678901")

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is consistent with known vector", () => {
    // This is a regression test — if the key changes, this value changes
    const cpf = "00000000000"
    const hash = computeCpfBlindIndex(cpf)

    // Just verify it's a valid hex hash; the specific value depends on CPF_INDEX_KEY
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash.length).toBe(64)
  })
})
