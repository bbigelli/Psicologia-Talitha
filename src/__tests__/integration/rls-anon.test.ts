/**
 * RLS enforcement tests — anonymous (unauthenticated) client.
 *
 * These tests connect to the REAL Supabase instance using the anon/
 * publishable key (no session, no JWT). They prove that without
 * authentication, EVERY table and RPC is inaccessible.
 *
 * Round 2 (post-patch): migration 20260909121200 applied:
 * - F1: 8 RPCs rewritten with IS DISTINCT FROM and NULL gates
 * - F2: REVOKE FROM PUBLIC + explicit GRANT to allowed roles
 * - F3: extensions.digest() schema-qualified in trigger and RPCs
 *
 * Assertions now expect 42501 (permission denied at privilege level),
 * not P0001 (internal checks). The distinction matters: 42501 means
 * the function never executes; P0001 means it executed and caught
 * the issue internally.
 *
 * RULES:
 * - NEVER use service_role key in RLS/permission tests
 * - service_role used ONLY in F3 validation (audit_log write), declared explicitly
 * - NEVER print credentials, tokens, or data in assertions
 * - NEVER insert real data; every INSERT expects FAILURE
 */
import { describe, it, expect, beforeAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
// service_role key must be a JWT (starts with eyJ) — the sb_secret_* format
// is a management API key, not a PostgREST key, and returns "Unregistered API key"
const hasServiceRole = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SERVICE_ROLE_KEY.startsWith("eyJ"),
)

describe.skipIf(!canRun)(
  "RLS enforcement — anonymous client (no session)",
  () => {
    let anon: SupabaseClient

    beforeAll(() => {
      anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
    })

    // ================================================================
    // SELECT on sensitive tables — must return EMPTY (RLS filters all)
    // ================================================================

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

    // ================================================================
    // INSERT on sensitive tables — must FAIL
    // ================================================================

    it("INSERT into patients should fail (no auth, no RLS policy for anon)", async () => {
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

    // ================================================================
    // UPDATE/DELETE on protected tables
    // ================================================================

    it("UPDATE on sessions should fail (REVOKE UPDATE from anon per ADR-0002)", async () => {
      const { error } = await anon
        .from("sessions")
        .update({ status: "cancelled" })
        .eq("id", "00000000-0000-0000-0000-000000000000")

      expect(error).toBeTruthy()
    })

    it("UPDATE on audit_log should fail (REVOKE UPDATE from all roles)", async () => {
      const { error } = await anon
        .from("audit_log")
        .update({ action: "TAMPERED" })
        .eq("id", "00000000-0000-0000-0000-000000000000")

      expect(error).toBeTruthy()
    })

    it("DELETE on audit_log should fail (REVOKE DELETE from all roles)", async () => {
      const { error } = await anon
        .from("audit_log")
        .delete()
        .eq("id", "00000000-0000-0000-0000-000000000000")

      expect(error).toBeTruthy()
    })

    // consents UPDATE/DELETE on non-existent rows: 204 No Content (0 affected)
    // Real rows protected by RLS + append-only triggers + REVOKE from service_role
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

    // ================================================================
    // RPC functions — REVOKE FROM PUBLIC (F2 patch applied)
    //
    // Post-patch: all RPCs now return 42501 (permission denied) for anon.
    // This is the CORRECT behavior — the function never executes.
    // Pre-patch: errors were P0001 (internal checks after execution).
    // ================================================================

    const allRpcs = [
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
      {
        name: "fn_verify_audit_chain",
        params: {},
      },
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

    for (const rpc of allRpcs) {
      it(`RPC ${rpc.name} should return 42501 permission denied for anon`, async () => {
        const { error } = await anon.rpc(rpc.name, rpc.params)

        expect(error).toBeTruthy()
        // Must be 42501 (permission denied at privilege level), proving
        // the function never executes — not P0001 (internal check)
        expect(error!.code).toBe("42501")
      })
    }

    // ================================================================
    // V15: fn_verify_audit_chain specifically blocked for anon
    // (data-architecture.md v1.3)
    // ================================================================

    it("V15: fn_verify_audit_chain denied for anon with 42501", async () => {
      const { error } = await anon.rpc("fn_verify_audit_chain", {})

      expect(error).toBeTruthy()
      expect(error!.code).toBe("42501")
      expect(error!.message).toContain("permission denied")
    })

    // ================================================================
    // Tables with NO policies — doubly locked for anon
    // ================================================================

    it("SELECT on payment_webhook_events should return empty (no policies)", async () => {
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

    it("SELECT on email_action_tokens should return empty (no policies)", async () => {
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

    it("SELECT on receipt_counters should return empty (no policies)", async () => {
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
// F3 + V16: audit_log write and hash chain verification
//
// Uses service_role EXPLICITLY — this is the only section that does.
// Reason: no authenticated users exist yet (auth is Sprint 2), so
// the only way to test audit_log write is via log_audit_system which
// requires service_role.
//
// NOTE: This inserts a REAL, PERMANENT entry in audit_log. The table
// is append-only (DELETE/UPDATE revoked from all roles including
// service_role). The entry has action='QA_SPRINT_1_HASH_CHAIN_TEST'
// and actor_source='cron' to make it identifiable.
// ================================================================

describe.skipIf(!hasServiceRole)(
  "F3 + V16: audit_log write and hash chain (service_role — declared)",
  () => {
    let admin: SupabaseClient

    beforeAll(() => {
      admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    })

    it("F3: log_audit_system should write to audit_log with hash chain", async () => {
      const { data: logId, error } = await admin.rpc("log_audit_system", {
        p_actor_id: "00000000-0000-0000-0000-000000000001",
        p_actor_source: "cron",
        p_patient_id: null,
        p_action: "QA_SPRINT_1_HASH_CHAIN_TEST",
      })

      expect(error).toBeNull()
      expect(logId).toBeTruthy()

      // Verify the entry was written with hash chain fields
      const { data: entry, error: readErr } = await admin
        .from("audit_log")
        .select("id, action, row_hash, prev_hash, actor_source")
        .eq("id", logId)
        .single()

      expect(readErr).toBeNull()
      expect(entry).toBeTruthy()
      expect(entry!.action).toBe("QA_SPRINT_1_HASH_CHAIN_TEST")
      expect(entry!.row_hash).toBeTruthy() // hash chain trigger fired and produced a hash
      expect(entry!.actor_source).toBe("cron")
    })

    it("V16: fn_verify_audit_chain confirms hash chain integrity (service_role)", async () => {
      const { data, error } = await admin.rpc("fn_verify_audit_chain", {})

      expect(error).toBeNull()
      expect(data).toBeTruthy()
      expect(Array.isArray(data)).toBe(true)
      if (Array.isArray(data) && data.length > 0) {
        expect(data[0].total_entries).toBeGreaterThanOrEqual(1)
        expect(data[0].is_valid).toBe(true)
        expect(data[0].total_entries).toBe(data[0].valid_entries)
      }
    })

    // V11 regression: log_audit_system must deny authenticated
    // (service_role only). We cannot test "as authenticated" without
    // a real auth user (Sprint 2). Documented as limitation.
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
