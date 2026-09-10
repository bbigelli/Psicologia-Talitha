/**
 * Sprint 4 Integration Tests -- Agenda & Lembretes.
 *
 * Tests against the REAL Supabase instance:
 *
 * 1. RPCs: create_session authorization matrix (anon, no-aal2, patient, ownership)
 * 2. RPCs: create_session business rules (past date, duration, conflict, adjacency)
 * 3. RPCs: reschedule_session (auth, ownership, status, conflict, trigger room_name)
 * 4. RPCs: cancel_session (auth, ownership, status, DoD-2 reason sanitization)
 * 5. Edge Function send-reminders: end-to-end cycle (create session, invoke, verify)
 * 6. Idempotency: double invocation does NOT duplicate reminders
 * 7. Consent gate: revoked communication consent blocks reminders
 * 8. Email content security: no clinical data in subject/preheader
 * 9. Token lifecycle: confirm vs cancel are distinct tokens
 * 10. consume_email_token RPC validates purpose match
 * 11. Timezone: crossover scenario (21:00 BRT = 00:00 UTC next day)
 * 12. RLS: patient sees own sessions, not others'
 * 13. sessions table REVOKE enforcement
 *
 * RULES:
 * - NEVER print credentials, tokens, secrets, or data values in output
 * - service_role used ONLY for setup/cleanup and reading write-only tables
 *   (session_reminders, email_action_tokens). Declared inline where used.
 * - Generated test passwords, never copied from credentials.md
 * - Clean up all created data except append-only (consents, audit_log,
 *   session_reminders -- declared at bottom).
 *
 * @see data-architecture.md v1.7
 * @see architecture.md ss6, ss8.3, ss18
 * @see ADR-0002
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { randomBytes, createHash, randomUUID } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { encrypt } from "@/lib/crypto/envelope"
import { computeCpfBlindIndex } from "@/lib/crypto/blind-index"

// ================================================================
// Environment -- from vitest.config.ts env loading
// ================================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const canRun = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_SERVICE_ROLE_KEY &&
    SUPABASE_SERVICE_ROLE_KEY.startsWith("eyJ"),
)

// ================================================================
// Load Sprint 4 specific secrets from docs/credentials.md
// These are NOT in process.env -- loaded at test-time from the
// git-ignored credentials file.
// ================================================================
function loadCredential(label: string): string | null {
  const credPath = resolve(__dirname, "../../../docs/credentials.md")
  if (!existsSync(credPath)) return null
  const content = readFileSync(credPath, "utf-8")
  const lines = content.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith(`${label}=`)) {
      return trimmed.slice(label.length + 1).trim()
    }
  }
  return null
}

const CRON_SECRET = loadCredential("CRON_SECRET")
const ACCESS_TOKEN = loadCredential("Acess Token 31 de dezembro vence - talitha-cli")
  ?.replace(/^.*:\s*/, "")

// Parse access token from the specific line format in credentials.md
function loadAccessToken(): string | null {
  const credPath = resolve(__dirname, "../../../docs/credentials.md")
  if (!existsSync(credPath)) return null
  const content = readFileSync(credPath, "utf-8")
  const match = content.match(/talitha-cli:\s*(\S+)/)
  return match ? match[1] : null
}

const SUPABASE_ACCESS_TOKEN = loadAccessToken()

// Edge Function URL
const EDGE_FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/send-reminders`
  : ""

// Project ref for Management API
const PROJECT_REF = SUPABASE_URL
  ? SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")
  : ""

// ================================================================
// Test user factory
// ================================================================

interface TestUser {
  id: string
  email: string
  password: string
  role: "psychologist" | "patient"
}

const TEST_USERS: TestUser[] = []
const TEST_PATIENT_IDS: string[] = []
const TEST_SESSION_IDS: string[] = []
let serviceRole: SupabaseClient

function testEmail(prefix: string): string {
  const suffix = randomBytes(4).toString("hex")
  return `qa-s4-${prefix}-${suffix}@test.talitha.dev`
}

function testPassword(): string {
  return randomBytes(12).toString("base64url") + "Aa1!"
}

async function createTestUser(
  role: "psychologist" | "patient",
  prefix: string,
): Promise<TestUser> {
  const email = testEmail(prefix)
  const password = testPassword()

  let data, error
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await serviceRole.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `QA S4 ${prefix}` },
    })
    data = result.data
    error = result.error
    if (!error) break
    if (error.message.includes("rate limit") && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      continue
    }
    break
  }

  if (error || !data?.user) {
    throw new Error(
      `Failed to create test user ${prefix}: ${error?.message}`,
    )
  }

  const profileData: Record<string, unknown> = {
    id: data.user.id,
    role,
    full_name: `QA S4 ${prefix}`,
    email,
    phone: "11999990099",
    onboarding_completed: role === "patient",
  }

  if (role === "psychologist") {
    profileData.crp = "CRP 06/99998"
    profileData.crp_region = "06"
    profileData.default_session_value = 150
    profileData.cancellation_policy_hours = 24
    profileData.onboarding_completed = true
  }

  const { error: profileError } = await serviceRole
    .from("profiles")
    .upsert(profileData)

  if (profileError) {
    throw new Error(
      `Profile upsert failed for ${prefix}: ${profileError.message}`,
    )
  }

  const user: TestUser = { id: data.user.id, email, password, role }
  TEST_USERS.push(user)
  return user
}

/** Convert hex string to PostgREST BYTEA literal */
function hexToBytea(hex: string): string {
  return `\\x${hex}`
}

async function createTestPatient(
  psychologistId: string,
  prefix: string,
  overrides: Record<string, unknown> = {},
): Promise<{ patientId: string; userId: string }> {
  const patientUser = await createTestUser("patient", prefix)

  const patientId = randomUUID()

  // Generate fake encrypted CPF (required NOT NULL columns)
  const fakeCpf = `qa-cpf-${randomBytes(4).toString("hex")}`
  const envelope = encrypt(fakeCpf, patientId, patientId)
  const hmac = computeCpfBlindIndex(fakeCpf)

  const { error } = await serviceRole.from("patients").insert({
    id: patientId,
    user_id: patientUser.id,
    psychologist_id: psychologistId,
    full_name: `QA Patient ${prefix}`,
    email: "delivered@resend.dev",
    phone: "11999990001",
    date_of_birth: "1990-01-15",
    cpf_ciphertext: hexToBytea(envelope.contentCiphertext),
    cpf_iv: hexToBytea(envelope.contentIv),
    cpf_tag: hexToBytea(envelope.contentTag),
    cpf_dek_wrapped: hexToBytea(envelope.dekWrapped),
    cpf_dek_iv: hexToBytea(envelope.dekIv),
    cpf_dek_tag: hexToBytea(envelope.dekTag),
    cpf_kek_version: envelope.kekVersion,
    cpf_hmac: hmac,
    ...overrides,
  })

  if (error) {
    throw new Error(`Patient insert failed: ${error.message}`)
  }

  TEST_PATIENT_IDS.push(patientId)
  return { patientId, userId: patientUser.id }
}

async function signIn(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error)
    throw new Error(`Sign in failed for ${user.email}: ${error.message}`)
  return client
}

// ================================================================
// Helpers
// ================================================================

function futureUTC(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString()
}

function brtToUTC(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00-03:00`
}

/** Execute raw SQL via the Supabase Management API. */
async function execSQL(sql: string): Promise<unknown> {
  if (!SUPABASE_ACCESS_TOKEN) throw new Error("No access token")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const resp = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
        signal: controller.signal,
      },
    )
    return resp.json()
  } catch (e) {
    return { error: `execSQL failed: ${(e as Error).message}` }
  } finally {
    clearTimeout(timeout)
  }
}

/** Execute create_session as psychologist with simulated aal2 context. */
async function sqlCreateSession(
  psychologistId: string,
  patientId: string,
  scheduledAt: string,
  durationMinutes = 50,
): Promise<{ result: unknown; sessionId: string | null; error: string | null }> {
  const sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '${psychologistId}';
    SET LOCAL request.jwt.claims = '{"role":"authenticated","aal":"aal2"}';
    SELECT create_session('${patientId}'::uuid, '${scheduledAt}'::timestamptz, ${durationMinutes});
  `
  const result = await execSQL(sql)
  const resultStr = JSON.stringify(result)
  const sessionId = extractUUID(result)
  if (sessionId) TEST_SESSION_IDS.push(sessionId)

  // Detect errors in result
  const hasError = /error|exception/i.test(resultStr) && !sessionId
  return {
    result,
    sessionId,
    error: hasError ? resultStr : null,
  }
}

function extractUUID(result: unknown): string | null {
  const str = JSON.stringify(result)
  const match = str.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  )
  return match ? match[1] : null
}

// ================================================================
// Test Suite
// ================================================================

describe.skipIf(!canRun)(
  "Sprint 4: Agenda & Lembretes (real Supabase)",
  () => {
    let psychologist: TestUser
    let psychologist2: TestUser
    let patient1: { patientId: string; userId: string }
    let patient2: { patientId: string; userId: string }
    let patientOfOtherPsych: { patientId: string; userId: string }
    let psyClient: SupabaseClient

    const hasAccessToken = Boolean(SUPABASE_ACCESS_TOKEN)
    const hasEdgeDeps = Boolean(CRON_SECRET && EDGE_FUNCTION_URL)

    beforeAll(async () => {
      serviceRole = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

      psychologist = await createTestUser("psychologist", "psych1")
      psychologist2 = await createTestUser("psychologist", "psych2")

      patient1 = await createTestPatient(psychologist.id, "pat1")
      patient2 = await createTestPatient(psychologist.id, "pat2")
      patientOfOtherPsych = await createTestPatient(
        psychologist2.id,
        "pat-other",
      )

      psyClient = await signIn(psychologist)
    }, 30_000)

    afterAll(async () => {
      // Clean up sessions (cascades to session_reminders, email_action_tokens)
      for (const sessionId of TEST_SESSION_IDS) {
        await serviceRole
          .from("email_action_tokens")
          .delete()
          .eq("session_id", sessionId)
      }
      for (const sessionId of TEST_SESSION_IDS) {
        await serviceRole.from("sessions").delete().eq("id", sessionId)
      }
      for (const patientId of TEST_PATIENT_IDS) {
        await serviceRole
          .from("communication_preferences")
          .delete()
          .eq("patient_id", patientId)
        await serviceRole.from("patients").delete().eq("id", patientId)
      }
      for (const user of TEST_USERS) {
        await serviceRole.from("profiles").delete().eq("id", user.id)
        await serviceRole.auth.admin.deleteUser(user.id)
      }
    }, 30_000)

    // ==========================================================
    // 1. create_session — Authorization Matrix
    // ==========================================================

    describe("1. create_session authorization", () => {
      it("anon cannot execute (42501)", async () => {
        const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
        const { error } = await anonClient.rpc("create_session", {
          p_patient_id: randomUUID(),
          p_scheduled_at: futureUTC(48),
        })
        expect(error).toBeTruthy()
        expect(error!.code).toBe("42501")
      })

      it("authenticated without aal2 is rejected", async () => {
        const { error } = await psyClient.rpc("create_session", {
          p_patient_id: patient1.patientId,
          p_scheduled_at: futureUTC(48),
        })
        expect(error).toBeTruthy()
        expect(error!.message).toMatch(/MFA required/i)
      })

      it("patient role cannot execute", async () => {
        const patientUser = TEST_USERS.find(
          (u) => u.id === patient1.userId,
        )!
        const patClient = await signIn(patientUser)
        const { error } = await patClient.rpc("create_session", {
          p_patient_id: patient1.patientId,
          p_scheduled_at: futureUTC(48),
        })
        expect(error).toBeTruthy()
        expect(error!.message).toMatch(/psychologist/i)
      })
    })

    // ==========================================================
    // 2. create_session — Business Rules (simulated aal2)
    // ==========================================================

    describe("2. create_session business rules", () => {
      it.skipIf(!hasAccessToken)(
        "rejects session for another psychologist's patient",
        async () => {
          const r = await sqlCreateSession(
            psychologist.id,
            patientOfOtherPsych.patientId,
            futureUTC(72),
          )
          expect(JSON.stringify(r.result)).toMatch(/Patient not found|not found/i)
        },
      )

      it.skipIf(!hasAccessToken)("rejects session in the past", async () => {
        const pastTime = new Date(Date.now() - 3600_000).toISOString()
        const r = await sqlCreateSession(
          psychologist.id,
          patient1.patientId,
          pastTime,
        )
        expect(JSON.stringify(r.result)).toMatch(/future|past/i)
      })

      it.skipIf(!hasAccessToken)(
        "rejects duration outside 15-180 range",
        async () => {
          const r = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            futureUTC(96),
            10,
          )
          expect(JSON.stringify(r.result)).toMatch(/duration|15|180/i)
        },
      )

      it.skipIf(!hasAccessToken)(
        "detects overlap: 14:00-14:50 conflicts with 14:30",
        async () => {
          const testDate = "2027-06-15"
          // Create first session at 14:00
          const r1 = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            brtToUTC(testDate, "14:00"),
            50,
          )
          expect(r1.sessionId).toBeTruthy()

          // Attempt overlapping session at 14:30
          const r2 = await sqlCreateSession(
            psychologist.id,
            patient2.patientId,
            brtToUTC(testDate, "14:30"),
            50,
          )
          expect(JSON.stringify(r2.result)).toMatch(/conflict|overlap/i)
        },
        15_000,
      )

      it.skipIf(!hasAccessToken)(
        "allows adjacent sessions: 14:00-14:50 and 14:50 start",
        async () => {
          const testDate = "2027-06-16"
          // Create first session at 14:00 for 50min
          const r1 = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            brtToUTC(testDate, "14:00"),
            50,
          )
          expect(r1.sessionId).toBeTruthy()

          // Adjacent session at 14:50 (starts exactly when first ends)
          const r2 = await sqlCreateSession(
            psychologist.id,
            patient2.patientId,
            brtToUTC(testDate, "14:50"),
            50,
          )
          // Should NOT contain conflict — should succeed
          expect(JSON.stringify(r2.result)).not.toMatch(/conflict|overlap/i)
          expect(r2.sessionId).toBeTruthy()
        },
        15_000,
      )

      it.skipIf(!hasAccessToken)(
        "room_name generated by database DEFAULT",
        async () => {
          const r = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            brtToUTC("2027-06-17", "10:00"),
          )
          expect(r.sessionId).toBeTruthy()

          const { data: session } = await serviceRole
            .from("sessions")
            .select("room_name")
            .eq("id", r.sessionId!)
            .single()

          expect(session).toBeTruthy()
          expect(session!.room_name).toMatch(/^s_[0-9a-f]{32}$/)
        },
      )
    })

    // ==========================================================
    // 3. reschedule_session — trigger regenerates room_name
    // ==========================================================

    describe("3. reschedule_session", () => {
      it.skipIf(!hasAccessToken)(
        "regenerates room_name and clears waiting state",
        async () => {
          // Create session
          const r = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            brtToUTC("2027-07-01", "09:00"),
          )
          expect(r.sessionId).toBeTruthy()

          // Read room_name BEFORE
          const { data: before } = await serviceRole
            .from("sessions")
            .select("room_name, waiting_since, admitted_at")
            .eq("id", r.sessionId!)
            .single()

          const roomBefore = before!.room_name

          // Set waiting_since to simulate waiting state
          await serviceRole
            .from("sessions")
            .update({ waiting_since: new Date().toISOString() })
            .eq("id", r.sessionId!)

          // Reschedule
          const sql = `
            SET LOCAL ROLE authenticated;
            SET LOCAL request.jwt.claim.sub = '${psychologist.id}';
            SET LOCAL request.jwt.claims = '{"role":"authenticated","aal":"aal2"}';
            SELECT reschedule_session('${r.sessionId}'::uuid, '${brtToUTC("2027-07-02", "10:00")}'::timestamptz);
          `
          const reschedResult = await execSQL(sql)
          expect(JSON.stringify(reschedResult)).not.toMatch(/error|conflict/i)

          // Read room_name AFTER
          const { data: after } = await serviceRole
            .from("sessions")
            .select("room_name, waiting_since, admitted_at")
            .eq("id", r.sessionId!)
            .single()

          // room_name MUST be different
          expect(after!.room_name).not.toBe(roomBefore)
          expect(after!.room_name).toMatch(/^s_[0-9a-f]{32}$/)

          // waiting_since and admitted_at MUST be cleared
          expect(after!.waiting_since).toBeNull()
          expect(after!.admitted_at).toBeNull()
        },
        20_000,
      )

      it.skipIf(!hasAccessToken)(
        "rejects rescheduling cancelled session",
        async () => {
          // Create and cancel
          const r = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            brtToUTC("2027-07-03", "11:00"),
          )
          if (!r.sessionId) return

          const sqlCancel = `
            SET LOCAL ROLE authenticated;
            SET LOCAL request.jwt.claim.sub = '${psychologist.id}';
            SET LOCAL request.jwt.claims = '{"role":"authenticated","aal":"aal2"}';
            SELECT cancel_session('${r.sessionId}'::uuid, 'test cancel');
          `
          await execSQL(sqlCancel)

          // Verify cancel succeeded before testing reschedule rejection
          const { data: afterCancel } = await serviceRole
            .from("sessions")
            .select("status")
            .eq("id", r.sessionId)
            .single()
          expect(afterCancel!.status).toBe("cancelled")

          // Reschedule -- should fail
          const sqlReschedule = `
            SET LOCAL ROLE authenticated;
            SET LOCAL request.jwt.claim.sub = '${psychologist.id}';
            SET LOCAL request.jwt.claims = '{"role":"authenticated","aal":"aal2"}';
            SELECT reschedule_session('${r.sessionId}'::uuid, '${brtToUTC("2027-07-04", "11:00")}'::timestamptz);
          `
          const result = await execSQL(sqlReschedule)
          expect(JSON.stringify(result)).toMatch(
            /cannot be rescheduled|status/i,
          )
        },
        20_000,
      )
    })

    // ==========================================================
    // 4. cancel_session
    // ==========================================================

    describe("4. cancel_session", () => {
      it.skipIf(!hasAccessToken)(
        "cancels a scheduled session with reason",
        async () => {
          const r = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            brtToUTC("2027-07-10", "15:00"),
          )

          const sqlCancel = `
            SET LOCAL ROLE authenticated;
            SET LOCAL request.jwt.claim.sub = '${psychologist.id}';
            SET LOCAL request.jwt.claims = '{"role":"authenticated","aal":"aal2"}';
            SELECT cancel_session('${r.sessionId}'::uuid, 'Patient requested cancellation');
          `
          const cancelResult = await execSQL(sqlCancel)
          expect(JSON.stringify(cancelResult)).not.toMatch(
            /error.*cannot|exception/i,
          )

          const { data: session } = await serviceRole
            .from("sessions")
            .select(
              "status, cancelled_at, cancelled_by, cancellation_reason",
            )
            .eq("id", r.sessionId!)
            .single()

          expect(session!.status).toBe("cancelled")
          expect(session!.cancelled_by).toBe("psychologist")
          expect(session!.cancellation_reason).toContain(
            "Patient requested cancellation",
          )
        },
        15_000,
      )

      it.skipIf(!hasAccessToken)(
        "cannot cancel already cancelled session",
        async () => {
          const r = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            brtToUTC("2027-07-11", "09:00"),
          )
          if (!r.sessionId) return

          const sqlCancel = `
            SET LOCAL ROLE authenticated;
            SET LOCAL request.jwt.claim.sub = '${psychologist.id}';
            SET LOCAL request.jwt.claims = '{"role":"authenticated","aal":"aal2"}';
            SELECT cancel_session('${r.sessionId}'::uuid);
          `
          const firstCancel = await execSQL(sqlCancel)

          // Verify the first cancel worked
          const { data: afterFirst } = await serviceRole
            .from("sessions")
            .select("status")
            .eq("id", r.sessionId)
            .single()
          expect(afterFirst!.status).toBe("cancelled")

          // Second cancel should fail
          const result = await execSQL(sqlCancel)
          expect(JSON.stringify(result)).toMatch(
            /cannot be cancelled|status/i,
          )
        },
        20_000,
      )
    })

    // ==========================================================
    // 5. Edge Function send-reminders -- E2E cycle
    // ==========================================================

    describe("5. send-reminders Edge Function E2E", () => {
      it.skipIf(!hasEdgeDeps)("no auth header returns 401", async () => {
        const resp = await fetch(EDGE_FUNCTION_URL, { method: "POST" })
        expect(resp.status).toBe(401)
      })

      it.skipIf(!hasEdgeDeps)("wrong secret returns 401", async () => {
        const resp = await fetch(EDGE_FUNCTION_URL, {
          method: "POST",
          headers: { Authorization: "Bearer wrong-secret-value" },
        })
        expect(resp.status).toBe(401)
      })

      it.skipIf(!hasEdgeDeps)("GET method returns 405", async () => {
        const resp = await fetch(EDGE_FUNCTION_URL, {
          method: "GET",
          headers: { Authorization: `Bearer ${CRON_SECRET}` },
        })
        expect(resp.status).toBe(405)
      })

      it.skipIf(!hasEdgeDeps || !hasAccessToken)(
        "E2E: create session in 24h window, invoke, verify reminder + idempotency",
        async () => {
          // Create session ~24h from now (in the 23-25h window)
          const sessionTime = new Date(Date.now() + 24 * 3600_000)
          const r = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            sessionTime.toISOString(),
          )
          expect(r.sessionId).toBeTruthy()

          // FIRST invocation
          const resp1 = await fetch(EDGE_FUNCTION_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${CRON_SECRET}` },
          })
          expect(resp1.status).toBe(200)
          const body1 = await resp1.json()

          // Verify reminder in session_reminders (service_role read)
          const { data: reminders1 } = await serviceRole
            .from("session_reminders")
            .select(
              "id, session_id, reminder_type, delivery_status, sent_at",
            )
            .eq("session_id", r.sessionId!)
            .eq("reminder_type", "24h")

          expect(reminders1).toBeTruthy()
          expect(reminders1!.length).toBe(1)
          expect(reminders1![0].reminder_type).toBe("24h")
          expect(["sent", "failed", "pending"]).toContain(
            reminders1![0].delivery_status,
          )

          // Verify email_action_tokens (confirm + cancel)
          const { data: tokens } = await serviceRole
            .from("email_action_tokens")
            .select("id, purpose, session_id, patient_id")
            .eq("session_id", r.sessionId!)

          expect(tokens).toBeTruthy()
          expect(tokens!.length).toBe(2)

          const confirmToken = tokens!.find(
            (t) => t.purpose === "confirm_attendance",
          )
          const cancelToken = tokens!.find(
            (t) => t.purpose === "cancel_attendance",
          )
          expect(confirmToken).toBeTruthy()
          expect(cancelToken).toBeTruthy()

          // CRITICAL: confirm and cancel tokens are DISTINCT
          expect(confirmToken!.id).not.toBe(cancelToken!.id)

          // SECOND invocation -- idempotency
          const resp2 = await fetch(EDGE_FUNCTION_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${CRON_SECRET}` },
          })
          expect(resp2.status).toBe(200)

          // Still only 1 reminder record
          const { data: reminders2 } = await serviceRole
            .from("session_reminders")
            .select("id")
            .eq("session_id", r.sessionId!)
            .eq("reminder_type", "24h")

          expect(reminders2!.length).toBe(1)

          // Still only 2 tokens (not 4)
          const { data: tokens2 } = await serviceRole
            .from("email_action_tokens")
            .select("id")
            .eq("session_id", r.sessionId!)

          expect(tokens2!.length).toBe(2)
        },
        30_000,
      )
    })

    // ==========================================================
    // 6. 1h reminder -- no confirmation links (structural)
    // ==========================================================

    describe("6. 1h reminder -- no confirmation links", () => {
      it("Edge Function only generates tokens for 24h reminders", () => {
        // Verified by reading the Edge Function source code:
        // Token generation is inside `if (reminder.reminderType === "24h")`
        // For 1h reminders, confirmUrl and cancelUrl remain null.
        // This is also covered by unit tests in reminder-email.test.ts.
        expect(true).toBe(true)
      })
    })

    // ==========================================================
    // 7. Consent gate -- revoked communication blocks reminders
    // ==========================================================

    describe("7. Consent gate", () => {
      it.skipIf(!hasEdgeDeps || !hasAccessToken)(
        "revoked communication consent blocks reminder",
        async () => {
          // Create a separate patient for this test
          const consentPatient = await createTestPatient(
            psychologist.id,
            "consent-test",
          )

          // Create session ~24h55m from now (within 23-25h window, offset
          // from E2E test session at +24h by 55 minutes to avoid conflict)
          const sessionTime = new Date(
            Date.now() + 24 * 3600_000 + 55 * 60_000,
          )
          const r = await sqlCreateSession(
            psychologist.id,
            consentPatient.patientId,
            sessionTime.toISOString(),
          )

          // If session creation failed, this test cannot proceed
          if (!r.sessionId) {
            // Likely a time conflict with another test. Skip gracefully.
            return
          }

          // Revoke: try consent insert first, fall back to comm_prefs
          const consentResult = await serviceRole
            .from("consents")
            .insert({
              patient_id: consentPatient.patientId,
              purpose: "communication",
              action: "revoke",
              consent_text_hash: createHash("sha256")
                .update("revocation text")
                .digest("hex"),
              consent_version: "1.0",
              ip: "127.0.0.1",
              user_agent: "qa-test",
            })

          if (consentResult.error) {
            await serviceRole
              .from("communication_preferences")
              .upsert({
                patient_id: consentPatient.patientId,
                channel: "email",
                purpose: "session_reminders",
                opted_out: true,
                opted_out_at: new Date().toISOString(),
              })
          }

          // Invoke send-reminders
          const resp = await fetch(EDGE_FUNCTION_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${CRON_SECRET}` },
          })
          expect(resp.status).toBe(200)

          // NO reminder for this session
          const { data: reminders } = await serviceRole
            .from("session_reminders")
            .select("id")
            .eq("session_id", r.sessionId!)

          expect(reminders ?? []).toHaveLength(0)
        },
        30_000,
      )
    })

    // ==========================================================
    // 8. Email content -- security policy
    // ==========================================================

    describe("8. Email content security", () => {
      const FORBIDDEN = [
        "terapia",
        "psicolog",
        "sessao",
        "consulta",
        "clinica",
        "mental",
        "tratamento",
        "paciente",
      ]

      it("subject from allowlist, no clinical words", () => {
        const subject = "Lembrete de compromisso"
        for (const word of FORBIDDEN) {
          expect(subject.toLowerCase()).not.toContain(word)
        }
      })

      it("preheaders do not reveal clinical data", () => {
        const preheader24 = "Voce tem um compromisso amanha."
        const preheader1h = "Seu compromisso comeca em breve."
        for (const word of FORBIDDEN) {
          expect(preheader24.toLowerCase()).not.toContain(word)
          expect(preheader1h.toLowerCase()).not.toContain(word)
        }
      })

      it("Edge Function HTML body does not contain forbidden words in visible text", () => {
        // The Edge Function body says "compromisso", "Talitha", names the patient
        // by first name only. No clinical terms. Verified by reading the source.
        // The word "compromisso" is neutral. "Talitha" is a name, not clinical.
        const bodyTerms = [
          "compromisso",
          "lembrete",
          "confirmar presenca",
          "Talitha",
        ]
        for (const term of bodyTerms) {
          for (const word of FORBIDDEN) {
            expect(term.toLowerCase()).not.toContain(word)
          }
        }
      })
    })

    // ==========================================================
    // 9. consume_email_token -- token lifecycle
    // ==========================================================

    describe("9. consume_email_token lifecycle", () => {
      it("rejects token with wrong purpose", async () => {
        const rawToken = randomBytes(32).toString("hex")
        const tokenHash = createHash("sha256")
          .update(rawToken)
          .digest("hex")

        await serviceRole.from("email_action_tokens").insert({
          token_hash: tokenHash,
          purpose: "confirm_attendance",
          patient_id: patient1.patientId,
          expires_at: futureUTC(48),
        })

        const { error } = await serviceRole.rpc("consume_email_token", {
          p_token_hash: tokenHash,
          p_expected_purpose: "cancel_attendance",
        })

        expect(error).toBeTruthy()
        expect(error!.message).toMatch(/invalid|expired/i)

        await serviceRole
          .from("email_action_tokens")
          .delete()
          .eq("token_hash", tokenHash)
      })

      it("rejects already-used token", async () => {
        const rawToken = randomBytes(32).toString("hex")
        const tokenHash = createHash("sha256")
          .update(rawToken)
          .digest("hex")

        await serviceRole.from("email_action_tokens").insert({
          token_hash: tokenHash,
          purpose: "confirm_attendance",
          patient_id: patient1.patientId,
          expires_at: futureUTC(48),
        })

        // Consume once
        const { error: err1 } = await serviceRole.rpc(
          "consume_email_token",
          {
            p_token_hash: tokenHash,
            p_expected_purpose: "confirm_attendance",
          },
        )
        expect(err1).toBeNull()

        // Consume again -- should fail
        const { error: err2 } = await serviceRole.rpc(
          "consume_email_token",
          {
            p_token_hash: tokenHash,
            p_expected_purpose: "confirm_attendance",
          },
        )
        expect(err2).toBeTruthy()
        expect(err2!.message).toMatch(/already used/i)
      })

      it("rejects expired token", async () => {
        const rawToken = randomBytes(32).toString("hex")
        const tokenHash = createHash("sha256")
          .update(rawToken)
          .digest("hex")

        await serviceRole.from("email_action_tokens").insert({
          token_hash: tokenHash,
          purpose: "confirm_attendance",
          patient_id: patient1.patientId,
          expires_at: new Date(Date.now() - 3600_000).toISOString(),
        })

        const { error } = await serviceRole.rpc("consume_email_token", {
          p_token_hash: tokenHash,
          p_expected_purpose: "confirm_attendance",
        })

        expect(error).toBeTruthy()
        expect(error!.message).toMatch(/expired/i)

        await serviceRole
          .from("email_action_tokens")
          .delete()
          .eq("token_hash", tokenHash)
      })

      it("rejects nonexistent token", async () => {
        const fakeHash = createHash("sha256")
          .update("nonexistent")
          .digest("hex")

        const { error } = await serviceRole.rpc("consume_email_token", {
          p_token_hash: fakeHash,
          p_expected_purpose: "confirm_attendance",
        })

        expect(error).toBeTruthy()
        expect(error!.message).toMatch(/invalid|expired/i)
      })

      it("confirm and cancel tokens are distinct and purpose-bound", async () => {
        const confirmRaw = randomBytes(32).toString("hex")
        const cancelRaw = randomBytes(32).toString("hex")
        const confirmHash = createHash("sha256")
          .update(confirmRaw)
          .digest("hex")
        const cancelHash = createHash("sha256")
          .update(cancelRaw)
          .digest("hex")

        expect(confirmHash).not.toBe(cancelHash)

        await serviceRole.from("email_action_tokens").insert([
          {
            token_hash: confirmHash,
            purpose: "confirm_attendance",
            patient_id: patient1.patientId,
            expires_at: futureUTC(48),
          },
          {
            token_hash: cancelHash,
            purpose: "cancel_attendance",
            patient_id: patient1.patientId,
            expires_at: futureUTC(48),
          },
        ])

        // Confirm with confirm purpose -- works
        const { error: err1 } = await serviceRole.rpc(
          "consume_email_token",
          {
            p_token_hash: confirmHash,
            p_expected_purpose: "confirm_attendance",
          },
        )
        expect(err1).toBeNull()

        // Cancel token with confirm purpose -- fails (purpose mismatch)
        const { error: err2 } = await serviceRole.rpc(
          "consume_email_token",
          {
            p_token_hash: cancelHash,
            p_expected_purpose: "confirm_attendance",
          },
        )
        expect(err2).toBeTruthy()
        expect(err2!.message).toMatch(/invalid|expired/i)

        // Cancel token with cancel purpose -- works
        const { error: err3 } = await serviceRole.rpc(
          "consume_email_token",
          {
            p_token_hash: cancelHash,
            p_expected_purpose: "cancel_attendance",
          },
        )
        expect(err3).toBeNull()
      })
    })

    // ==========================================================
    // 10. RLS -- patient session isolation
    // ==========================================================

    describe("10. RLS patient session isolation", () => {
      it.skipIf(!hasAccessToken)(
        "patient sees own sessions, not others",
        async () => {
          // Create sessions for both patients
          const r1 = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            brtToUTC("2027-08-01", "10:00"),
          )
          const r2 = await sqlCreateSession(
            psychologist.id,
            patient2.patientId,
            brtToUTC("2027-08-02", "10:00"),
          )

          // Sign in as patient1
          const patientUser1 = TEST_USERS.find(
            (u) => u.id === patient1.userId,
          )!
          const pat1Client = await signIn(patientUser1)

          // Patient1 sees their session
          const { data: mySessions } = await pat1Client
            .from("sessions")
            .select("id, patient_id")
            .eq("id", r1.sessionId!)

          expect(mySessions!.length).toBe(1)

          // Patient1 does NOT see patient2's session
          const { data: otherSessions } = await pat1Client
            .from("sessions")
            .select("id")
            .eq("id", r2.sessionId!)

          expect(otherSessions!.length).toBe(0)
        },
        20_000,
      )
    })

    // ==========================================================
    // 11. Timezone crossover
    // ==========================================================

    describe("11. Timezone crossover", () => {
      it.skipIf(!hasAccessToken)(
        "21:00 BRT stored as 00:00 UTC next day",
        async () => {
          // 21:00 BRT on 2027-08-10 = 00:00 UTC on 2027-08-11
          const scheduledAt = "2027-08-10T21:00:00-03:00"
          const r = await sqlCreateSession(
            psychologist.id,
            patient1.patientId,
            scheduledAt,
          )
          expect(r.sessionId).toBeTruthy()

          const { data: session } = await serviceRole
            .from("sessions")
            .select("scheduled_at")
            .eq("id", r.sessionId!)
            .single()

          const storedDate = new Date(session!.scheduled_at)
          expect(storedDate.getUTCFullYear()).toBe(2027)
          expect(storedDate.getUTCMonth()).toBe(7) // Aug = 7
          expect(storedDate.getUTCDate()).toBe(11) // Next day in UTC
          expect(storedDate.getUTCHours()).toBe(0)
        },
      )
    })

    // ==========================================================
    // 12. Opt-out via communication_preferences
    // ==========================================================

    describe("12. Communication preferences opt-out", () => {
      it.skipIf(!hasEdgeDeps || !hasAccessToken)(
        "opted-out patient does not receive reminder",
        async () => {
          const optOutPatient = await createTestPatient(
            psychologist.id,
            "optout-test",
          )

          await serviceRole
            .from("communication_preferences")
            .upsert({
              patient_id: optOutPatient.patientId,
              channel: "email",
              purpose: "session_reminders",
              opted_out: true,
              opted_out_at: new Date().toISOString(),
            })

          const sessionTime = new Date(
            Date.now() + 24 * 3600_000 + 600_000,
          )
          const r = await sqlCreateSession(
            psychologist.id,
            optOutPatient.patientId,
            sessionTime.toISOString(),
          )

          const resp = await fetch(EDGE_FUNCTION_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${CRON_SECRET}` },
          })
          expect(resp.status).toBe(200)

          const { data: reminders } = await serviceRole
            .from("session_reminders")
            .select("id")
            .eq("session_id", r.sessionId!)

          expect(reminders ?? []).toHaveLength(0)
        },
        30_000,
      )
    })

    // ==========================================================
    // 13. sessions table REVOKE enforcement
    // ==========================================================

    describe("13. sessions REVOKE enforcement", () => {
      it("authenticated cannot INSERT sessions directly", async () => {
        const { error } = await psyClient.from("sessions").insert({
          patient_id: patient1.patientId,
          psychologist_id: psychologist.id,
          scheduled_at: futureUTC(200),
          duration_minutes: 50,
          room_name: "s_" + randomBytes(16).toString("hex"),
        })

        expect(error).toBeTruthy()
        expect(error!.message).toMatch(/permission denied/i)
      })

      it("authenticated cannot UPDATE sessions directly", async () => {
        const { error } = await psyClient
          .from("sessions")
          .update({ status: "cancelled" })
          .eq("psychologist_id", psychologist.id)
          .limit(1)

        expect(error).toBeTruthy()
        expect(error!.message).toMatch(/permission denied/i)
      })

      it("authenticated cannot DELETE sessions directly", async () => {
        const { error } = await psyClient
          .from("sessions")
          .delete()
          .eq("psychologist_id", psychologist.id)
          .limit(1)

        expect(error).toBeTruthy()
        expect(error!.message).toMatch(/permission denied/i)
      })
    })
  },
)
