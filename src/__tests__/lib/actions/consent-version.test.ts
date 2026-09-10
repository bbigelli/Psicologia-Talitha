/**
 * Consent version check tests.
 *
 * Verifies that hasActiveConsents correctly enforces version matching:
 * - Accept at current version -> active
 * - Accept at old version -> NOT active (forces re-accept)
 * - Revoke -> NOT active
 * - Missing purpose -> NOT active
 *
 * Uses a mock Supabase client that returns controlled data.
 *
 * @see W1 from code review Sprint 3
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the Supabase module before importing the function under test
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

// We need to test hasActiveConsents which queries supabase.
// We'll build a minimal mock that simulates the chained query API.
function createMockSupabase(
  consentsData: Array<{
    purpose: string
    action: string
    consent_version: string
    occurred_at: string
  }> | null,
) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: consentsData,
            }),
          }),
        }),
      }),
    }),
  } as unknown as import("@supabase/supabase-js").SupabaseClient
}

// Import AFTER mocks are set up
import { hasActiveConsents } from "@/lib/actions/consents"
import { CURRENT_CONSENT_VERSION } from "@/schemas/consent"

const PATIENT_ID = "test-patient-id"

describe("hasActiveConsents — version check (W1)", () => {
  it("returns true when all required purposes accepted at current version", async () => {
    const supabase = createMockSupabase([
      {
        purpose: "online_therapy",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:00:00Z",
      },
      {
        purpose: "lgpd_clinical",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:01:00Z",
      },
      {
        purpose: "lgpd_asaas",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:02:00Z",
      },
    ])

    const result = await hasActiveConsents(supabase, PATIENT_ID)
    expect(result).toBe(true)
  })

  it("returns false when a required purpose was accepted at OLD version", async () => {
    const supabase = createMockSupabase([
      {
        purpose: "online_therapy",
        action: "accept",
        consent_version: "0.9", // OLD version
        occurred_at: "2026-09-09T10:00:00Z",
      },
      {
        purpose: "lgpd_clinical",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:01:00Z",
      },
      {
        purpose: "lgpd_asaas",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:02:00Z",
      },
    ])

    const result = await hasActiveConsents(supabase, PATIENT_ID)
    expect(result).toBe(false)
  })

  it("returns false when latest action is revoke", async () => {
    const supabase = createMockSupabase([
      {
        purpose: "online_therapy",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:00:00Z",
      },
      {
        purpose: "lgpd_clinical",
        action: "revoke", // revoked
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T11:00:00Z",
      },
      {
        purpose: "lgpd_clinical",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:01:00Z", // older accept
      },
      {
        purpose: "lgpd_asaas",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:02:00Z",
      },
    ])

    const result = await hasActiveConsents(supabase, PATIENT_ID)
    expect(result).toBe(false)
  })

  it("returns false when a required purpose is missing", async () => {
    const supabase = createMockSupabase([
      {
        purpose: "online_therapy",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:00:00Z",
      },
      {
        purpose: "lgpd_clinical",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:01:00Z",
      },
      // lgpd_asaas is MISSING
    ])

    const result = await hasActiveConsents(supabase, PATIENT_ID)
    expect(result).toBe(false)
  })

  it("returns false when no consents exist", async () => {
    const supabase = createMockSupabase([])
    const result = await hasActiveConsents(supabase, PATIENT_ID)
    expect(result).toBe(false)
  })

  it("returns false when query returns null", async () => {
    const supabase = createMockSupabase(null)
    const result = await hasActiveConsents(supabase, PATIENT_ID)
    expect(result).toBe(false)
  })

  it("re-accept at current version after old version makes consent active", async () => {
    // Patient accepted v0.9, then re-accepted v1.0.
    // The data is ordered by occurred_at DESC, so v1.0 comes first.
    const supabase = createMockSupabase([
      {
        purpose: "online_therapy",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-10T10:00:00Z", // re-accepted at current version
      },
      {
        purpose: "online_therapy",
        action: "accept",
        consent_version: "0.9",
        occurred_at: "2026-09-09T10:00:00Z", // old accept
      },
      {
        purpose: "lgpd_clinical",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:01:00Z",
      },
      {
        purpose: "lgpd_asaas",
        action: "accept",
        consent_version: CURRENT_CONSENT_VERSION,
        occurred_at: "2026-09-09T10:02:00Z",
      },
    ])

    const result = await hasActiveConsents(supabase, PATIENT_ID)
    expect(result).toBe(true)
  })
})
