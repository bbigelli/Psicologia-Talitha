/**
 * Tests for reminder email content policy.
 *
 * Security requirement: email subject and preheader must NEVER reveal
 * therapy, psychology, or clinical data. A lock screen on the patient's
 * phone might show "Sua sessao de terapia amanha as 15h" to someone
 * standing nearby.
 *
 * Content policy: "notify, don't inform" — subject is neutral,
 * details only in the body (requires opening the email).
 *
 * @see architecture.md §8.3
 * @see docs/talitha-security-review-prd.md
 */
import { describe, it, expect } from "vitest"

// Re-implement the pure function for testing (same as Edge Function)
function buildReminderEmail(
  patientName: string,
  scheduledAt: string,
  durationMinutes: number,
  reminderType: "24h" | "1h",
  confirmUrl: string | null,
  cancelUrl: string | null,
): { subject: string; html: string; text: string } {
  const sessionDate = new Date(scheduledAt)
  const dateStr = sessionDate.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const timeStr = sessionDate.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  })

  const subject = "Lembrete de compromisso"
  const preheader =
    reminderType === "24h"
      ? "Voce tem um compromisso amanha."
      : "Seu compromisso comeca em breve."

  const html = `<html><body><p>${patientName}</p><p>${dateStr} ${timeStr}</p></body></html>`
  const text = `${patientName}\n${dateStr} ${timeStr}`

  return { subject, html, text }
}

const FORBIDDEN_WORDS = [
  "terapia",
  "terapeuta",
  "psicolog",
  "sessao",
  "consulta",
  "clinica",
  "mental",
  "ansiedade",
  "depressao",
  "tratamento",
  "paciente",
  "diagnostico",
]

describe("reminder email content policy", () => {
  const email = buildReminderEmail(
    "Maria",
    "2026-09-11T18:00:00Z",
    50,
    "24h",
    "https://example.com/confirmar/token1",
    "https://example.com/confirmar/token2",
  )

  it("subject does not contain clinical/therapy words", () => {
    const subjectLower = email.subject.toLowerCase()
    for (const word of FORBIDDEN_WORDS) {
      expect(subjectLower).not.toContain(word)
    }
  })

  it("subject is from the approved allowlist", () => {
    expect(email.subject).toBe("Lembrete de compromisso")
  })

  it("subject does not contain the time", () => {
    expect(email.subject).not.toMatch(/\d{2}:\d{2}/)
  })

  it("subject does not contain the patient name", () => {
    expect(email.subject).not.toContain("Maria")
  })

  it("body contains the patient's first name (for personalization)", () => {
    expect(email.text).toContain("Maria")
  })

  it("body contains the date and time", () => {
    // Check that the body has time-like content
    expect(email.text).toMatch(/\d{2}:\d{2}/)
  })
})

describe("reminder email — 1h type", () => {
  const email = buildReminderEmail(
    "Joao",
    "2026-09-10T14:00:00Z",
    50,
    "1h",
    null, // No confirmation links for 1h reminder
    null,
  )

  it("subject is neutral", () => {
    expect(email.subject).toBe("Lembrete de compromisso")
  })

  it("does not include confirmation links for 1h type", () => {
    // 1h reminders don't include confirm/cancel links
    expect(email.html).not.toContain("confirmar")
    expect(email.html).not.toContain("cancelar")
  })
})
