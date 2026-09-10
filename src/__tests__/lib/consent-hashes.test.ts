/**
 * Consent text hash integrity test — Sprint 3.
 *
 * CRITICAL: The precomputed hashes in CONSENT_HASHES must match the
 * SHA-256 of the actual consent text constants. If they don't, the
 * consent record in `consents` points to a hash that doesn't correspond
 * to the text the patient actually saw — destroying the evidentiary
 * value of the consent (a litigation risk).
 *
 * This test recomputes SHA-256 of each text and compares with the
 * precomputed constant. If it fails, someone changed the text without
 * regenerating the hashes.
 *
 * Category: Small (pure crypto, no I/O)
 */
import { describe, it, expect } from "vitest"
import { createHash } from "node:crypto"
import {
  CONSENT_TEXT_ONLINE_THERAPY,
  CONSENT_TEXT_LGPD_CLINICAL,
  CONSENT_TEXT_LGPD_ASAAS,
  CONSENT_TEXT_COMMUNICATION,
  CONSENT_HASHES,
} from "@/lib/consent-texts"

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

describe("Consent hash integrity", () => {
  it("online_therapy hash matches text", () => {
    const computed = sha256(CONSENT_TEXT_ONLINE_THERAPY)
    expect(computed).toBe(CONSENT_HASHES.online_therapy)
  })

  it("lgpd_clinical hash matches text", () => {
    const computed = sha256(CONSENT_TEXT_LGPD_CLINICAL)
    expect(computed).toBe(CONSENT_HASHES.lgpd_clinical)
  })

  it("lgpd_asaas hash matches text", () => {
    const computed = sha256(CONSENT_TEXT_LGPD_ASAAS)
    expect(computed).toBe(CONSENT_HASHES.lgpd_asaas)
  })

  it("communication hash matches text", () => {
    const computed = sha256(CONSENT_TEXT_COMMUNICATION)
    expect(computed).toBe(CONSENT_HASHES.communication)
  })

  it("all 4 hashes are distinct", () => {
    const values = Object.values(CONSENT_HASHES)
    const unique = new Set(values)
    expect(unique.size).toBe(4)
  })

  it("all hashes are 64-char hex strings", () => {
    for (const [key, hash] of Object.entries(CONSENT_HASHES)) {
      expect(hash, `${key} should be 64 chars`).toHaveLength(64)
      expect(hash, `${key} should be lowercase hex`).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})

describe("Consent text content (E7 compliance)", () => {
  it("online_therapy term includes clause about online format", () => {
    expect(CONSENT_TEXT_ONLINE_THERAPY).toContain("FORMATO ONLINE")
  })

  it("online_therapy term includes cancellation policy clause", () => {
    expect(CONSENT_TEXT_ONLINE_THERAPY).toContain("POLITICA DE FALTAS")
  })

  it("online_therapy term includes connection drop clause", () => {
    expect(CONSENT_TEXT_ONLINE_THERAPY).toContain("QUEDA DE CONEXAO")
  })

  it("online_therapy term references Resolucao CFP 09/2024", () => {
    expect(CONSENT_TEXT_ONLINE_THERAPY).toContain("09/2024")
  })

  it("lgpd_clinical term mentions AES-256-GCM encryption", () => {
    expect(CONSENT_TEXT_LGPD_CLINICAL).toContain("AES-256-GCM")
  })

  it("lgpd_clinical term specifies 5-year retention", () => {
    expect(CONSENT_TEXT_LGPD_CLINICAL).toContain("5 anos")
  })

  it("lgpd_asaas term specifies neutral billing description", () => {
    expect(CONSENT_TEXT_LGPD_ASAAS).toContain(
      "Prestacao de servicos profissionais",
    )
  })

  it("lgpd_asaas term confirms no clinical data shared", () => {
    expect(CONSENT_TEXT_LGPD_ASAAS).toContain(
      "Nenhuma informacao clinica",
    )
  })
})
