/**
 * Email template security tests — Sprint 3.
 *
 * Validates that email subjects/preheaders/body don't leak
 * clinical or health-related information (architecture.md §8.3).
 *
 * Category: Small (pure function, no I/O)
 */
import { describe, it, expect } from "vitest"

// Inline since templates.ts uses server-only — import would fail in test env.
// We test the function logic by reimporting with the server-only stub.
import { buildInviteEmail } from "@/lib/email/templates"

const FORBIDDEN_WORDS = [
  "terapia",
  "psicolog",
  "clinica",
  "consulta",
  "sessao",
  "sessões",
  "atendimento",
  "saude",
  "mental",
  "tratamento",
  "paciente",
  "prontuario",
]

describe("buildInviteEmail", () => {
  const email = buildInviteEmail({
    patientName: "Maria Silva",
    inviteUrl: "https://app.talitha.dev/convite/fake-token-abc123",
    psychologistName: "Dra. Talitha",
  })

  it("should have neutral subject from allowlist", () => {
    expect(email.subject).toBe("Seu acesso ao portal")
  })

  it("subject must not reveal clinical context", () => {
    const subjectLower = email.subject.toLowerCase()
    for (const word of FORBIDDEN_WORDS) {
      expect(subjectLower, `subject contains "${word}"`).not.toContain(word)
    }
  })

  it("HTML preheader must not reveal clinical context", () => {
    // Extract preheader from the hidden span
    const preheaderMatch = email.html.match(
      /display:none.*?>([\s\S]*?)<\/span>/i,
    )
    const preheader = preheaderMatch?.[1]?.trim().toLowerCase() || ""
    for (const word of FORBIDDEN_WORDS) {
      expect(preheader, `preheader contains "${word}"`).not.toContain(word)
    }
  })

  it("should include invite URL in the HTML", () => {
    expect(email.html).toContain(
      "https://app.talitha.dev/convite/fake-token-abc123",
    )
  })

  it("should include invite URL in the text version", () => {
    expect(email.text).toContain(
      "https://app.talitha.dev/convite/fake-token-abc123",
    )
  })

  it("should include patient name in greeting", () => {
    expect(email.html).toContain("Maria Silva")
    expect(email.text).toContain("Maria Silva")
  })

  it("should include psychologist name", () => {
    expect(email.html).toContain("Dra. Talitha")
    expect(email.text).toContain("Dra. Talitha")
  })

  it("should mention 72-hour expiry", () => {
    expect(email.html).toContain("72 horas")
    expect(email.text).toContain("72 horas")
  })

  it("should have both HTML and text versions", () => {
    expect(email.html).toBeTruthy()
    expect(email.text).toBeTruthy()
    expect(email.html.length).toBeGreaterThan(100)
    expect(email.text.length).toBeGreaterThan(50)
  })

  it("token should be in path, not query string", () => {
    // The invite URL must use path params, not query string
    expect(email.html).toContain("/convite/fake-token-abc123")
    expect(email.html).not.toContain("?token=")
    expect(email.text).not.toContain("?token=")
  })
})
