/**
 * RLS and privilege enforcement tests against the REAL Supabase instance.
 *
 * Round 3 (post-split): migration 20260909121300 applied:
 * - fn_verify_audit_chain restricted to authenticated (psychologist)
 * - fn_anchor_audit_chain created for service_role (cron anchor)
 * - service_role REVOKED from fn_verify_audit_chain
 *
 * Three client types:
 * - anon: no session, no JWT — proves public internet is locked out
 * - service_role: server-side, bypasses RLS — used ONLY for F3 write test
 * - (authenticated: Sprint 2 — not available yet)
 *
 * RULES:
 * - service_role used ONLY in declared F3/V16/V17 section
 * - NEVER print credentials, tokens, or data in assertions
 * - NEVER insert real data that expects success in the anon section
 */
import { describe, it, expect, beforeAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
const hasServiceRole = Boolean(
  SUPABASE_URL &&
    SUPABASE_SERVICE_ROLE_KEY &&
    SUPABASE_SERVICE_ROLE_KEY.startsWith("eyJ"),
)

// ================================================================
// SECTION 1: Anonymous client — all tables and RPCs locked
// ================================================================

describe.skipIf(!canRun)(
  "RLS enforcement — anonymous client (no session)",
  () => {
    let anon: SupabaseClient

    beforeAll(() => {
      anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
    })

    // SELECT on sensitive tables — must return EMPTY
    const sensitiveTables = [
      "patients",
      "clinical_records",
      "anamnesis",
      "sessions",
      "charges",
      "consents",
      "audit_log",
      "remote_viability_assessments",
      "session_note_drafts",
      "receipts",
      "profiles",
      "subscriptions",
      "data_subject_requests",
      "communication_preferences",
      "session_reminders",
      "billing_rule_events",
    ]

    for (const table of sensitiveTables) {
      it(`SELECT on ${table} should return empty or error (never data)`, async () => {
        const { data, error } = await anon.from(table).select("id").limit(1)

        if (error) {
          expect(error.code).toBeTruthy()
        } else {
          expect(data).toEqual([])
        }
      })
    }

    // INSERT on sensitive tables — must FAIL
    it("INSERT into patients should fail", async () => {
      const { error } = await anon.from("patients").insert({
        psychologist_id: "00000000-0000-0000-0000-000000000000",
        full_name: "Test Patient",
        email: "test@test.com",
        status: "invited",
      })
      expect(error).toBeTruthy()
      expect(error!.code).toBeTruthy()
    })

    it("INSERT into clinical_records should fail", async () => {
      const { error } = await anon.from("clinical_records").insert({
        patient_id: "00000000-0000-0000-0000-000000000000",
        psychologist_id: "00000000-0000-0000-0000-000000000000",
        session_date: "2026-01-01",
        content_ciphertext: "fake",
        content_iv: "fake",
        content_tag: "fake",
        dek_wrapped: "fake",
        dek_iv: "fake",
        dek_tag: "fake",
        kek_version: 1,
      })
      expect(error).toBeTruthy()
    })

    it("INSERT into audit_log should fail", async () => {
      const { error } = await anon.from("audit_log").insert({
        actor_id: "00000000-0000-0000-0000-000000000000",
        actor_source: "user",
        action: "TEST_INSERT",
      })
      expect(error).toBeTruthy()
    })

    it("INSERT into consents should fail", async () => {
      const { error } = await anon.from("consents").insert({
        patient_id: "00000000-0000-0000-0000-000000000000",
        purpose: "data_processing",
        action: "grant",
        ip: "127.0.0.1",
      })
      expect(error).toBeTruthy()
    })

    it("INSERT into sessions should fail (REVOKE INSERT from anon)", async () => {
      const { error } = await anon.from("sessions").insert({
        patient_id: "00000000-0000-0000-0000-000000000000",
        psychologist_id: "00000000-0000-0000-0000-000000000000",
        scheduled_at: "2026-01-01T10:00:00Z",
        duration_minutes: 50,
        session_value: 200,
        status: "scheduled",
      })
      expect(error).toBeTruthy()
    })

    // UPDATE/DELETE on protected tables
    it("UPDATE on sessions should fail (REVOKE UPDATE)", async () => {
      const { error } = await anon
        .from("sessions")
        .update({ status: "cancelled" })
        .eq("id", "00000000-0000-0000-0000-000000000000")
      expect(error).toBeTruthy()
    })

    it("UPDATE on audit_log should fail (REVOKE UPDATE from all)", async () => {
      const { error } = await anon
        .from("audit_log")
        .update({ action: "TAMPERED" })
        .eq("id", "00000000-0000-0000-0000-000000000000")
      expect(error).toBeTruthy()
    })

    it("DELETE on audit_log should fail (REVOKE DELETE from all)", async () => {
      const { error } = await anon
        .from("audit_log")
        .delete()
        .eq("id", "00000000-0000-0000-0000-000000000000")
      expect(error).toBeTruthy()
    })

    it("UPDATE on consents with non-existent id yields 0 affected rows", async () => {
      const { data, error, status } = await anon
        .from("consents")
        .update({ action: "revoke" })
        .eq("id", "00000000-0000-0000-0000-000000000000")
      const isBlocked = error !== null || data === null || status === 204
      expect(isBlocked).toBe(true)
    })

    it("DELETE on consents with non-existent id yields 0 affected rows", async () => {
      const { data, error, status } = await anon
        .from("consents")
        .delete()
        .eq("id", "00000000-0000-0000-0000-000000000000")
      const isBlocked = error !== null || data === null || status === 204
      expect(isBlocked).toBe(true)
    })

    // RPCs with REVOKE FROM PUBLIC — all must return 42501
    const rpcsBlockedForAnon = [
      {
        name: "log_audit",
        params: {
          p_patient_id: "00000000-0000-0000-0000-000000000000",
          p_action: "TEST",
        },
      },
      {
        name: "enter_waiting_room",
        params: { p_session_id: "00000000-0000-0000-0000-000000000000" },
      },
      {
        name: "admit_patient",
        params: { p_session_id: "00000000-0000-0000-0000-000000000000" },
      },
      {
        name: "cancel_session",
        params: { p_session_id: "00000000-0000-0000-0000-000000000000" },
      },
      {
        name: "consume_email_token",
        params: { p_token_hash: "fake_hash", p_expected_purpose: "confirm" },
      },
      { name: "fn_verify_audit_chain", params: {} },
      {
        name: "log_audit_system",
        params: {
          p_actor_id: "00000000-0000-0000-0000-000000000000",
          p_actor_source: "anonymous",
          p_patient_id: "00000000-0000-0000-0000-000000000000",
          p_action: "TEST",
        },
      },
    ]

    for (const rpc of rpcsBlockedForAnon) {
      it(`RPC ${rpc.name} should return 42501 for anon`, async () => {
        const { error } = await anon.rpc(rpc.name, rpc.params)
        expect(error).toBeTruthy()
        expect(error!.code).toBe("42501")
      })
    }

    // V15: fn_verify_audit_chain specifically blocked for anon
    it("V15: fn_verify_audit_chain denied for anon with 42501", async () => {
      const { error } = await anon.rpc("fn_verify_audit_chain", {})
      expect(error).toBeTruthy()
      expect(error!.code).toBe("42501")
      expect(error!.message).toContain("permission denied")
    })

    // FINDING F4: fn_anchor_audit_chain accessible by anon
    //
    // The migration 121300 has REVOKE FROM PUBLIC + GRANT TO service_role,
    // but Supabase ALTER DEFAULT PRIVILEGES creates direct grants to
    // anon and authenticated. REVOKE FROM PUBLIC only removes PUBLIC
    // inheritance — the direct grants to anon/authenticated persist.
    //
    // Fix: add REVOKE FROM anon, authenticated before GRANT TO service_role.
    // Same root cause as F2 but for a new function.
    it("FINDING F4: fn_anchor_audit_chain is accessible by anon (missing REVOKE from anon)", async () => {
      const { data, error } = await anon.rpc("fn_anchor_audit_chain", {})

      // BUG: should get 42501 but the function executes
      // This documents the current (broken) behavior
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    })

    // Tables with NO policies — doubly locked for anon
    it("SELECT on payment_webhook_events should return empty", async () => {
      const { data, error } = await anon
        .from("payment_webhook_events")
        .select("id")
        .limit(1)
      if (error) {
        expect(error.code).toBeTruthy()
      } else {
        expect(data).toEqual([])
      }
    })

    it("SELECT on email_action_tokens should return empty", async () => {
      const { data, error } = await anon
        .from("email_action_tokens")
        .select("id")
        .limit(1)
      if (error) {
        expect(error.code).toBeTruthy()
      } else {
        expect(data).toEqual([])
      }
    })

    it("SELECT on receipt_counters should return empty", async () => {
      const { data, error } = await anon
        .from("receipt_counters")
        .select("id")
        .limit(1)
      if (error) {
        expect(error.code).toBeTruthy()
      } else {
        expect(data).toEqual([])
      }
    })
  },
)

// ================================================================
// SECTION 2: service_role — F3/V16/V17 validation
//
// Uses service_role EXPLICITLY for:
// 1. Writing a test entry to audit_log (F3 proof)
// 2. Verifying hash chain via fn_anchor_audit_chain (V16/V17)
// 3. Confirming fn_verify_audit_chain is DENIED for service_role (split)
//
// NOTE: The audit_log entry (action='QA_SPRINT_1_HASH_CHAIN_TEST',
// actor_source='anonymous') is PERMANENT. The table is append-only
// — DELETE/UPDATE revoked from all roles including service_role.
// ================================================================

describe.skipIf(!hasServiceRole)(
  "F3/V16/V17: audit_log write, hash chain, anchor split (service_role — declared)",
  () => {
    let admin: SupabaseClient

    beforeAll(() => {
      admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    })

    it("F3/V16: log_audit_system writes to audit_log with hash chain", async () => {
      // Arrange — use anonymous actor_source with NULL actor_id
      // (avoids FK constraint on actor_id → auth.users)
      const { data: logId, error } = await admin.rpc("log_audit_system", {
        p_actor_id: null,
        p_actor_source: "anonymous",
        p_patient_id: null,
        p_action: "QA_SPRINT_1_HASH_CHAIN_TEST",
      })

      // Act — entry must be written
      expect(error).toBeNull()
      expect(logId).toBeTruthy()

      // Assert — read the entry and verify hash chain fields
      const { data: entry, error: readErr } = await admin
        .from("audit_log")
        .select("id, action, row_hash, prev_hash, actor_source")
        .eq("id", logId as string)
        .single()

      expect(readErr).toBeNull()
      expect(entry).toBeTruthy()
      expect(entry!.action).toBe("QA_SPRINT_1_HASH_CHAIN_TEST")
      expect(entry!.actor_source).toBe("anonymous")
      // CRITICAL: row_hash must be populated — proves extensions.digest()
      // resolves correctly in the SECURITY DEFINER trigger search_path
      expect(entry!.row_hash).toBeTruthy()
    })

    it("V17: fn_anchor_audit_chain succeeds for service_role and reports valid chain", async () => {
      const { data, error } = await admin.rpc("fn_anchor_audit_chain", {})

      expect(error).toBeNull()
      expect(data).toBeTruthy()
      expect(Array.isArray(data)).toBe(true)

      const anchor = (data as Array<Record<string, unknown>>)[0]
      expect(anchor.is_valid).toBe(true)
      expect(anchor.total_entries).toBeGreaterThanOrEqual(1)
      // last_row_hash must be a hex string (sha256 = 64 hex chars)
      expect(typeof anchor.last_row_hash).toBe("string")
      expect((anchor.last_row_hash as string).length).toBe(64)
      expect(anchor.last_occurred_at).toBeTruthy()
    })

    it("V17: fn_verify_audit_chain is DENIED for service_role (split)", async () => {
      const { error } = await admin.rpc("fn_verify_audit_chain", {})

      // service_role was explicitly REVOKED in migration 121300
      expect(error).toBeTruthy()
      expect(error!.code).toBe("42501")
    })
  },
)

// Informational: skip reason when credentials are not available
describe.skipIf(canRun)(
  "RLS integration tests — SKIPPED (credentials not in env)",
  () => {
    it("requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
      expect(true).toBe(true)
    })
  },
)
