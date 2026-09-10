/**
 * Tests for the reminder decision logic.
 *
 * The determineReminders function is a pure function extracted from
 * the send-reminders Edge Function. It takes:
 * - current time
 * - list of sessions
 * - set of opted-out patient IDs
 *
 * And returns which reminders should be sent.
 *
 * This allows testing the core logic without Deno, Supabase, or Resend.
 *
 * @see supabase/functions/send-reminders/index.ts
 * @see US-304
 */
import { describe, it, expect } from "vitest"

// Re-implement the pure function here for testing (same logic as Edge Function)
// This avoids importing from a Deno module in a Node.js test environment.

interface SessionToRemind {
  id: string
  patient_id: string
  psychologist_id: string
  scheduled_at: string
  duration_minutes: number
  status: string
}

function determineReminders(
  now: Date,
  sessions: SessionToRemind[],
  optedOutPatientIds: Set<string>,
): Array<{ session: SessionToRemind; reminderType: "24h" | "1h" }> {
  const results: Array<{
    session: SessionToRemind
    reminderType: "24h" | "1h"
  }> = []

  for (const session of sessions) {
    if (!["scheduled", "confirmed"].includes(session.status)) continue
    if (optedOutPatientIds.has(session.patient_id)) continue

    const sessionTime = new Date(session.scheduled_at)
    const hoursUntil =
      (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    // 24h reminder: between 23h and 25h before session
    if (hoursUntil >= 23 && hoursUntil <= 25) {
      results.push({ session, reminderType: "24h" })
    }

    // 1h reminder: between 0.5h and 1.5h before session
    if (hoursUntil >= 0.5 && hoursUntil <= 1.5) {
      results.push({ session, reminderType: "1h" })
    }
  }

  return results
}

function makeSession(
  overrides: Partial<SessionToRemind> = {},
): SessionToRemind {
  return {
    id: "session-1",
    patient_id: "patient-1",
    psychologist_id: "psych-1",
    scheduled_at: new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString(),
    duration_minutes: 50,
    status: "scheduled",
    ...overrides,
  }
}

describe("determineReminders — pure logic", () => {
  it("returns 24h reminder for session ~24h away", () => {
    const now = new Date("2026-09-10T10:00:00Z")
    const session = makeSession({
      scheduled_at: "2026-09-11T10:00:00Z", // exactly 24h away
    })

    const results = determineReminders(now, [session], new Set())
    expect(results).toHaveLength(1)
    expect(results[0].reminderType).toBe("24h")
  })

  it("returns 1h reminder for session ~1h away", () => {
    const now = new Date("2026-09-10T09:00:00Z")
    const session = makeSession({
      scheduled_at: "2026-09-10T10:00:00Z", // 1h away
    })

    const results = determineReminders(now, [session], new Set())
    expect(results).toHaveLength(1)
    expect(results[0].reminderType).toBe("1h")
  })

  it("returns NO reminder for session 12h away (in between windows)", () => {
    const now = new Date("2026-09-10T10:00:00Z")
    const session = makeSession({
      scheduled_at: "2026-09-10T22:00:00Z", // 12h away
    })

    const results = determineReminders(now, [session], new Set())
    expect(results).toHaveLength(0)
  })

  it("skips cancelled sessions", () => {
    const now = new Date("2026-09-10T10:00:00Z")
    const session = makeSession({
      scheduled_at: "2026-09-11T10:00:00Z",
      status: "cancelled",
    })

    const results = determineReminders(now, [session], new Set())
    expect(results).toHaveLength(0)
  })

  it("skips completed sessions", () => {
    const now = new Date("2026-09-10T10:00:00Z")
    const session = makeSession({
      scheduled_at: "2026-09-11T10:00:00Z",
      status: "completed",
    })

    const results = determineReminders(now, [session], new Set())
    expect(results).toHaveLength(0)
  })

  it("skips opted-out patients", () => {
    const now = new Date("2026-09-10T10:00:00Z")
    const session = makeSession({
      scheduled_at: "2026-09-11T10:00:00Z",
      patient_id: "patient-opted-out",
    })

    const results = determineReminders(
      now,
      [session],
      new Set(["patient-opted-out"]),
    )
    expect(results).toHaveLength(0)
  })

  it("does NOT skip non-opted-out patients", () => {
    const now = new Date("2026-09-10T10:00:00Z")
    const session = makeSession({
      scheduled_at: "2026-09-11T10:00:00Z",
      patient_id: "patient-active",
    })

    const results = determineReminders(
      now,
      [session],
      new Set(["different-patient"]),
    )
    expect(results).toHaveLength(1)
  })

  it("handles multiple sessions at different windows", () => {
    const now = new Date("2026-09-10T10:00:00Z")
    const sessions = [
      makeSession({
        id: "s1",
        scheduled_at: "2026-09-11T10:00:00Z", // 24h
      }),
      makeSession({
        id: "s2",
        scheduled_at: "2026-09-10T11:00:00Z", // 1h
      }),
      makeSession({
        id: "s3",
        scheduled_at: "2026-09-12T10:00:00Z", // 48h — no reminder
      }),
    ]

    const results = determineReminders(now, sessions, new Set())
    expect(results).toHaveLength(2)
    expect(results.find((r) => r.session.id === "s1")?.reminderType).toBe(
      "24h",
    )
    expect(results.find((r) => r.session.id === "s2")?.reminderType).toBe(
      "1h",
    )
  })

  it("includes confirmed sessions", () => {
    const now = new Date("2026-09-10T10:00:00Z")
    const session = makeSession({
      scheduled_at: "2026-09-11T10:00:00Z",
      status: "confirmed",
    })

    const results = determineReminders(now, [session], new Set())
    expect(results).toHaveLength(1)
  })

  it("tolerates 15-min cron window for 24h reminder", () => {
    const now = new Date("2026-09-10T10:00:00Z")

    // Session at 23h15m from now (within 23-25h window)
    const sessionTime = new Date(
      now.getTime() + 23.25 * 60 * 60 * 1000,
    )
    const session = makeSession({
      scheduled_at: sessionTime.toISOString(),
    })

    const results = determineReminders(now, [session], new Set())
    expect(results).toHaveLength(1)
    expect(results[0].reminderType).toBe("24h")
  })

  it("returns empty array for empty sessions list", () => {
    const now = new Date()
    const results = determineReminders(now, [], new Set())
    expect(results).toHaveLength(0)
  })
})
