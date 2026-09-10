/**
 * Sprint 3 Integration Tests — Patients & Consent.
 *
 * Tests against the REAL Supabase instance:
 *
 * 1. BYTEA round-trip: encrypt -> write -> read -> decrypt -> compare original
 *    - Patient CPF (Sprint 3 format with \\x prefix)
 *    - Psychologist CPF (Sprint 2 format WITHOUT \\x prefix) — code-level bug
 * 2. Blind index: HMAC deterministic, duplicate detection, no plaintext
 * 3. Age CHECK constraint: DB rejects minors even if zod bypassed
 * 4. Consent: append-only, UPDATE/DELETE blocked (by triggers + grants)
 * 5. acceptInvite: token lifecycle (valid, expired, used, wrong purpose)
 * 6. RLS: patient isolation, cross-patient blocking
 * 7. Column-level grants: cpf columns not readable by authenticated
 * 8. Psychologist reads patients and consents via RLS
 *
 * BYTEA format note: PostgREST returns BYTEA columns as `\x` + hex string.
 * NOT base64. To reconstruct the hex, strip the `\x` prefix.
 *
 * RULES:
 * - NEVER print real CPFs, tokens, or secrets
 * - service_role ONLY for setup/cleanup and reading write-only cipher columns
 * - Synthetic CPFs with valid mod-11 check digits
 * - Clean up created data (except append-only consents/audit_log)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { randomBytes, createHash, randomUUID } from "node:crypto"
import { encrypt, decrypt, type EncryptedEnvelope } from "@/lib/crypto/envelope"
import { computeCpfBlindIndex } from "@/lib/crypto/blind-index"

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
// Synthetic CPFs — mod-11 valid, not real
// ================================================================
const PATIENT_CPF_1 = "52998224725"
const PATIENT_CPF_2 = "11144477735"
const PSYCHOLOGIST_CPF = "71145417740"

// ================================================================
// BYTEA helpers
// ================================================================

/** Convert hex string to PostgREST BYTEA literal (\\x prefix) */
function hexToBytea(hex: string): string {
  return `\\x${hex}`
}

/**
 * Convert PostgREST BYTEA output back to hex.
 * PostgREST returns BYTEA as `\x` + hex, NOT base64.
 */
function byteaToHex(val: string): string {
  if (val.startsWith("\\x")) return val.slice(2)
  // Fallback: might already be plain hex
  return val
}

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
const TEST_PATIENTS: string[] = []
let serviceRole: SupabaseClient

function testEmail(prefix: string): string {
  const suffix = randomBytes(4).toString("hex")
  return `qa3-${prefix}-${suffix}@test.talitha.dev`
}

function testPassword(): string {
  return randomBytes(12).toString("base64url") + "Aa1!"
}

function adultDob(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 30)
  return d.toISOString().slice(0, 10)
}

function minorDob(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 16)
  return d.toISOString().slice(0, 10)
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
      app_metadata: { role },
      user_metadata: { full_name: `QA3 Test ${prefix}` },
    })
    data = result.data
    error = result.error
    if (!error) break
    if (error.message.includes("rate limit") && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
  }

  if (error || !data?.user) {
    throw new Error(`Failed to create test user: ${error?.message}`)
  }

  await serviceRole.from("profiles").insert({
    id: data.user.id,
    role,
    full_name: `QA3 Test ${prefix}`,
    email,
  })

  const user: TestUser = { id: data.user.id, email, password, role }
  TEST_USERS.push(user)
  return user
}

async function signIn(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error) throw new Error(`SignIn failed for ${user.role}: ${error.message}`)
  return client
}

async function cleanupTestUsers(): Promise<void> {
  for (const user of TEST_USERS) {
    try {
      await serviceRole.auth.admin.deleteUser(user.id)
    } catch {
      // best effort
    }
  }
  TEST_USERS.length = 0
}

async function cleanupTestPatients(): Promise<void> {
  for (const id of TEST_PATIENTS) {
    try {
      await serviceRole
        .from("email_action_tokens")
        .delete()
        .eq("patient_id", id)
      await serviceRole.from("patients").delete().eq("id", id)
    } catch {
      // best effort
    }
  }
  TEST_PATIENTS.length = 0
}

// ================================================================
// 1. BYTEA ROUND-TRIP — HIGHEST PRIORITY
// ================================================================
describe.runIf(canRun)(
  "1. BYTEA round-trip: encrypt -> store -> read -> decrypt",
  () => {
    let psych: TestUser

    beforeAll(async () => {
      serviceRole = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      psych = await createTestUser("psychologist", "bytea-psych")
    })

    afterAll(async () => {
      await cleanupTestPatients()
      await cleanupTestUsers()
    })

    it("Sprint 3 format (hexToBytea prefix): patient CPF survives round-trip", async () => {
      const patientId = randomUUID()
      const envelope = encrypt(PATIENT_CPF_1, patientId, "cpf")
      const hmac = computeCpfBlindIndex(PATIENT_CPF_1)

      const { error: insertErr } = await serviceRole
        .from("patients")
        .insert({
          id: patientId,
          user_id: null,
          psychologist_id: psych.id,
          full_name: "QA3 Roundtrip Patient",
          email: testEmail("rt-s3"),
          date_of_birth: adultDob(),
          cpf_ciphertext: hexToBytea(envelope.contentCiphertext),
          cpf_iv: hexToBytea(envelope.contentIv),
          cpf_tag: hexToBytea(envelope.contentTag),
          cpf_dek_wrapped: hexToBytea(envelope.dekWrapped),
          cpf_dek_iv: hexToBytea(envelope.dekIv),
          cpf_dek_tag: hexToBytea(envelope.dekTag),
          cpf_kek_version: envelope.kekVersion,
          cpf_hmac: hmac,
          status: "invited",
        })

      expect(insertErr, `insert error: ${insertErr?.message}`).toBeNull()
      TEST_PATIENTS.push(patientId)

      // Read via service_role (cipher columns write-only for authenticated)
      const { data: row, error: readErr } = await serviceRole
        .from("patients")
        .select(
          "cpf_ciphertext, cpf_iv, cpf_tag, cpf_dek_wrapped, cpf_dek_iv, cpf_dek_tag, cpf_kek_version",
        )
        .eq("id", patientId)
        .single()

      expect(readErr).toBeNull()
      expect(row).toBeTruthy()

      // PostgREST returns BYTEA as \x + hex — strip prefix to get hex
      const readEnvelope: EncryptedEnvelope = {
        contentCiphertext: byteaToHex(row!.cpf_ciphertext),
        contentIv: byteaToHex(row!.cpf_iv),
        contentTag: byteaToHex(row!.cpf_tag),
        dekWrapped: byteaToHex(row!.cpf_dek_wrapped),
        dekIv: byteaToHex(row!.cpf_dek_iv),
        dekTag: byteaToHex(row!.cpf_dek_tag),
        kekVersion: row!.cpf_kek_version,
      }

      const decrypted = decrypt(readEnvelope, patientId, "cpf")
      expect(decrypted).toBe(PATIENT_CPF_1)
    })

    it("Sprint 2 format (raw hex, NO prefix): write to profiles BYTEA column", async () => {
      // Sprint 2 completeOnboarding writes hex WITHOUT \x prefix.
      // Test what PostgREST does with raw hex in a BYTEA column.
      const profileId = psych.id
      const envelope = encrypt(PSYCHOLOGIST_CPF, profileId, "cpf")

      // Write with Sprint 2 pattern: raw hex, NO \\x prefix
      const { error: updateErr } = await serviceRole
        .from("profiles")
        .update({
          cpf_ciphertext: envelope.contentCiphertext, // raw hex
          cpf_iv: envelope.contentIv,
          cpf_tag: envelope.contentTag,
          cpf_dek_wrapped: envelope.dekWrapped,
          cpf_dek_iv: envelope.dekIv,
          cpf_dek_tag: envelope.dekTag,
          cpf_kek_version: envelope.kekVersion,
        })
        .eq("id", profileId)

      expect(updateErr, `update error: ${updateErr?.message}`).toBeNull()

      // Read back via service_role
      const { data: row, error: readErr } = await serviceRole
        .from("profiles")
        .select(
          "cpf_ciphertext, cpf_iv, cpf_tag, cpf_dek_wrapped, cpf_dek_iv, cpf_dek_tag, cpf_kek_version",
        )
        .eq("id", profileId)
        .single()

      expect(readErr).toBeNull()
      expect(row).toBeTruthy()

      // Check what came back — does it have \x prefix?
      const rawCt = row!.cpf_ciphertext as string
      const rawTag = row!.cpf_tag as string
      const rawIv = row!.cpf_iv as string

      // PostgREST returns \x + hex for binary data.
      // If Sprint 2 stored the hex as literal text bytes (without \x prefix),
      // the stored binary would be the ASCII codes of the hex characters,
      // which is DIFFERENT from the actual binary. The returned hex would
      // be the hex representation of those ASCII codes.
      //
      // For example: hex string "ab" → without prefix → stored as bytes 0x61 0x62
      // (ASCII 'a' and 'b') → returned as \x6162 → stripping prefix → "6162"
      // Original was "ab" but we get "6162" — data is corrupted.

      let decrypted: string | null = null
      let decryptError: Error | null = null

      try {
        const readEnvelope: EncryptedEnvelope = {
          contentCiphertext: byteaToHex(rawCt),
          contentIv: byteaToHex(rawIv),
          contentTag: byteaToHex(rawTag),
          dekWrapped: byteaToHex(row!.cpf_dek_wrapped),
          dekIv: byteaToHex(row!.cpf_dek_iv),
          dekTag: byteaToHex(row!.cpf_dek_tag),
          kekVersion: row!.cpf_kek_version,
        }
        decrypted = decrypt(readEnvelope, profileId, "cpf")
      } catch (e) {
        decryptError = e as Error
      }

      if (decryptError) {
        // This is the EXPECTED outcome — Sprint 2 format is BROKEN.
        // The raw hex was stored as literal ASCII bytes, not binary.
        // Verify that the stored length is doubled (each hex char → 1 byte)
        const storedTagHex = byteaToHex(rawTag)
        const expectedTagLen = 32 // 16 bytes = 32 hex chars
        const storedTagLen = storedTagHex.length

        // If stored as ASCII of hex, the tag would be:
        // 32 hex chars → 32 ASCII bytes → returned as 64 hex chars
        expect(storedTagLen).toBe(expectedTagLen * 2)

        // This CONFIRMS the Sprint 2 bug: raw hex stored as text bytes
        // The test passes (the bug is documented), but the code is WRONG.
        // profile.ts needs hexToBytea() like patients.ts has.
        expect(true).toBe(true)
      } else {
        // If somehow it decrypted fine, that means PostgREST auto-detected hex.
        // Document this unexpected behavior.
        expect(decrypted).toBe(PSYCHOLOGIST_CPF)
      }
    })

    it("format divergence: raw hex produces doubled byte count vs prefixed", async () => {
      // Insert same 16-byte data in two formats and compare stored sizes
      const patientIdA = randomUUID()
      const envelopeA = encrypt("fmt-a", patientIdA, "cpf")
      const hmacA = computeCpfBlindIndex("fmt-a-" + randomUUID())

      // With prefix
      await serviceRole.from("patients").insert({
        id: patientIdA,
        user_id: null,
        psychologist_id: psych.id,
        full_name: "QA3 FmtA",
        email: testEmail("fmta"),
        date_of_birth: adultDob(),
        cpf_ciphertext: hexToBytea(envelopeA.contentCiphertext),
        cpf_iv: hexToBytea(envelopeA.contentIv),
        cpf_tag: hexToBytea(envelopeA.contentTag),
        cpf_dek_wrapped: hexToBytea(envelopeA.dekWrapped),
        cpf_dek_iv: hexToBytea(envelopeA.dekIv),
        cpf_dek_tag: hexToBytea(envelopeA.dekTag),
        cpf_kek_version: envelopeA.kekVersion,
        cpf_hmac: hmacA,
        status: "invited",
      })
      TEST_PATIENTS.push(patientIdA)

      // Without prefix (same envelope data)
      const patientIdB = randomUUID()
      const hmacB = computeCpfBlindIndex("fmt-b-" + randomUUID())

      await serviceRole.from("patients").insert({
        id: patientIdB,
        user_id: null,
        psychologist_id: psych.id,
        full_name: "QA3 FmtB",
        email: testEmail("fmtb"),
        date_of_birth: adultDob(),
        cpf_ciphertext: envelopeA.contentCiphertext, // NO prefix
        cpf_iv: envelopeA.contentIv,
        cpf_tag: envelopeA.contentTag,
        cpf_dek_wrapped: envelopeA.dekWrapped,
        cpf_dek_iv: envelopeA.dekIv,
        cpf_dek_tag: envelopeA.dekTag,
        cpf_kek_version: envelopeA.kekVersion,
        cpf_hmac: hmacB,
        status: "invited",
      })
      TEST_PATIENTS.push(patientIdB)

      // Read both
      const { data: rowA } = await serviceRole
        .from("patients")
        .select("cpf_tag")
        .eq("id", patientIdA)
        .single()
      const { data: rowB } = await serviceRole
        .from("patients")
        .select("cpf_tag")
        .eq("id", patientIdB)
        .single()

      const hexA = byteaToHex(rowA!.cpf_tag)
      const hexB = byteaToHex(rowB!.cpf_tag)

      // With prefix: 16 bytes → 32 hex chars after stripping \x
      // Without prefix: 32 ASCII bytes → 64 hex chars after stripping \x
      expect(hexA.length).toBe(32) // correct: 16 bytes
      expect(hexB.length).toBe(64) // corrupted: 32 bytes (doubled)

      // Prefixed version decrypts
      const envA: EncryptedEnvelope = {
        contentCiphertext: byteaToHex(
          (
            await serviceRole
              .from("patients")
              .select(
                "cpf_ciphertext, cpf_iv, cpf_tag, cpf_dek_wrapped, cpf_dek_iv, cpf_dek_tag, cpf_kek_version",
              )
              .eq("id", patientIdA)
              .single()
          ).data!.cpf_ciphertext,
        ),
        contentIv: hexA.length === 32 ? byteaToHex(rowA!.cpf_tag) : "", // unused, just reread
        contentTag: hexA,
        dekWrapped: "",
        dekIv: "",
        dekTag: "",
        kekVersion: 1,
      }
      // Just verify that the sizes confirm the format divergence
      expect(hexB.length).toBeGreaterThan(hexA.length)
    })
  },
)

// ================================================================
// 2. BLIND INDEX (HMAC)
// ================================================================
describe.runIf(canRun)(
  "2. Blind index: determinism, uniqueness, no plaintext",
  () => {
    let psych: TestUser

    beforeAll(async () => {
      serviceRole = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      psych = await createTestUser("psychologist", "blind-psych")
    })

    afterAll(async () => {
      await cleanupTestPatients()
      await cleanupTestUsers()
    })

    it("HMAC is deterministic for the same CPF", () => {
      const h1 = computeCpfBlindIndex(PATIENT_CPF_1)
      const h2 = computeCpfBlindIndex(PATIENT_CPF_1)
      expect(h1).toBe(h2)
    })

    it("HMAC produces different values for different CPFs", () => {
      const h1 = computeCpfBlindIndex(PATIENT_CPF_1)
      const h2 = computeCpfBlindIndex(PATIENT_CPF_2)
      expect(h1).not.toBe(h2)
    })

    it("duplicate CPF detected via UNIQUE constraint on cpf_hmac", async () => {
      const patientId1 = randomUUID()
      const envelope1 = encrypt(PATIENT_CPF_1, patientId1, "cpf")
      const hmac = computeCpfBlindIndex(PATIENT_CPF_1)

      const { error: err1 } = await serviceRole.from("patients").insert({
        id: patientId1,
        user_id: null,
        psychologist_id: psych.id,
        full_name: "QA3 Dup CPF 1",
        email: testEmail("dup1"),
        date_of_birth: adultDob(),
        cpf_ciphertext: hexToBytea(envelope1.contentCiphertext),
        cpf_iv: hexToBytea(envelope1.contentIv),
        cpf_tag: hexToBytea(envelope1.contentTag),
        cpf_dek_wrapped: hexToBytea(envelope1.dekWrapped),
        cpf_dek_iv: hexToBytea(envelope1.dekIv),
        cpf_dek_tag: hexToBytea(envelope1.dekTag),
        cpf_kek_version: envelope1.kekVersion,
        cpf_hmac: hmac,
        status: "invited",
      })
      expect(err1).toBeNull()
      TEST_PATIENTS.push(patientId1)

      const patientId2 = randomUUID()
      const envelope2 = encrypt(PATIENT_CPF_1, patientId2, "cpf")
      const { error: err2 } = await serviceRole.from("patients").insert({
        id: patientId2,
        user_id: null,
        psychologist_id: psych.id,
        full_name: "QA3 Dup CPF 2",
        email: testEmail("dup2"),
        date_of_birth: adultDob(),
        cpf_ciphertext: hexToBytea(envelope2.contentCiphertext),
        cpf_iv: hexToBytea(envelope2.contentIv),
        cpf_tag: hexToBytea(envelope2.contentTag),
        cpf_dek_wrapped: hexToBytea(envelope2.dekWrapped),
        cpf_dek_iv: hexToBytea(envelope2.dekIv),
        cpf_dek_tag: hexToBytea(envelope2.dekTag),
        cpf_kek_version: envelope2.kekVersion,
        cpf_hmac: hmac, // same HMAC
        status: "invited",
      })

      expect(err2).not.toBeNull()
      expect(err2!.code).toBe("23505") // unique_violation
    })

    it("CPF not visible in plaintext in any column", async () => {
      const { data: rows } = await serviceRole
        .from("patients")
        .select(
          "id, full_name, email, phone, date_of_birth, status, cpf_hmac",
        )
        .eq("psychologist_id", psych.id)

      if (rows) {
        for (const row of rows) {
          const allValues = Object.values(row).join(" ")
          expect(allValues).not.toContain(PATIENT_CPF_1)
          expect(allValues).not.toContain(PATIENT_CPF_2)
        }
      }
    })
  },
)

// ================================================================
// 3. AGE CHECK CONSTRAINT (Emenda E1) — DB level
// ================================================================
describe.runIf(canRun)(
  "3. Age CHECK constraint rejects minors at DB level",
  () => {
    let psych: TestUser

    beforeAll(async () => {
      serviceRole = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      psych = await createTestUser("psychologist", "age-psych")
    })

    afterAll(async () => {
      await cleanupTestPatients()
      await cleanupTestUsers()
    })

    it("DB CHECK rejects patient with date_of_birth < 18 years ago", async () => {
      const patientId = randomUUID()
      const envelope = encrypt(PATIENT_CPF_2, patientId, "cpf")
      const hmac = computeCpfBlindIndex("age-minor-" + randomUUID())

      const { error } = await serviceRole.from("patients").insert({
        id: patientId,
        user_id: null,
        psychologist_id: psych.id,
        full_name: "QA3 Minor Patient",
        email: testEmail("minor"),
        date_of_birth: minorDob(),
        cpf_ciphertext: hexToBytea(envelope.contentCiphertext),
        cpf_iv: hexToBytea(envelope.contentIv),
        cpf_tag: hexToBytea(envelope.contentTag),
        cpf_dek_wrapped: hexToBytea(envelope.dekWrapped),
        cpf_dek_iv: hexToBytea(envelope.dekIv),
        cpf_dek_tag: hexToBytea(envelope.dekTag),
        cpf_kek_version: envelope.kekVersion,
        cpf_hmac: hmac,
        status: "invited",
      })

      expect(error).not.toBeNull()
      expect(error!.code).toBe("23514") // check_violation
      expect(error!.message).toContain("chk_patient_adult")
    })

    it("DB CHECK accepts patient exactly 18 years old", async () => {
      const dob = new Date()
      dob.setFullYear(dob.getFullYear() - 18)
      const dobStr = dob.toISOString().slice(0, 10)

      const patientId = randomUUID()
      const envelope = encrypt("test18", patientId, "cpf")
      const hmac = computeCpfBlindIndex("age-18-" + randomUUID())

      const { error } = await serviceRole.from("patients").insert({
        id: patientId,
        user_id: null,
        psychologist_id: psych.id,
        full_name: "QA3 Adult18 Patient",
        email: testEmail("adult18"),
        date_of_birth: dobStr,
        cpf_ciphertext: hexToBytea(envelope.contentCiphertext),
        cpf_iv: hexToBytea(envelope.contentIv),
        cpf_tag: hexToBytea(envelope.contentTag),
        cpf_dek_wrapped: hexToBytea(envelope.dekWrapped),
        cpf_dek_iv: hexToBytea(envelope.dekIv),
        cpf_dek_tag: hexToBytea(envelope.dekTag),
        cpf_kek_version: envelope.kekVersion,
        cpf_hmac: hmac,
        status: "invited",
      })

      expect(error, `insert error: ${error?.message}`).toBeNull()
      TEST_PATIENTS.push(patientId)
    })
  },
)

// ================================================================
// 4. CONSENT: append-only enforcement
// ================================================================
describe.runIf(canRun)(
  "4. Consent append-only and required purposes",
  () => {
    let psych: TestUser
    let patient: TestUser
    let patientRecordId: string
    let patientClient: SupabaseClient

    beforeAll(async () => {
      serviceRole = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      psych = await createTestUser("psychologist", "consent-psych")

      // Delay to avoid rate limit from previous describe blocks
      await new Promise((r) => setTimeout(r, 2000))

      patient = await createTestUser("patient", "consent-pat")

      patientRecordId = randomUUID()
      const envelope = encrypt("consent-cpf", patientRecordId, "cpf")
      const hmac = computeCpfBlindIndex("consent-" + randomUUID())

      await serviceRole.from("patients").insert({
        id: patientRecordId,
        user_id: patient.id,
        psychologist_id: psych.id,
        full_name: "QA3 Consent Patient",
        email: patient.email,
        date_of_birth: adultDob(),
        cpf_ciphertext: hexToBytea(envelope.contentCiphertext),
        cpf_iv: hexToBytea(envelope.contentIv),
        cpf_tag: hexToBytea(envelope.contentTag),
        cpf_dek_wrapped: hexToBytea(envelope.dekWrapped),
        cpf_dek_iv: hexToBytea(envelope.dekIv),
        cpf_dek_tag: hexToBytea(envelope.dekTag),
        cpf_kek_version: envelope.kekVersion,
        cpf_hmac: hmac,
        status: "active",
      })
      TEST_PATIENTS.push(patientRecordId)

      patientClient = await signIn(patient)
    })

    afterAll(async () => {
      // Consents are append-only — cannot delete
      await cleanupTestPatients()
      await cleanupTestUsers()
    })

    it("patient can INSERT consent for own record", async () => {
      const { error } = await patientClient.from("consents").insert({
        patient_id: patientRecordId,
        purpose: "online_therapy",
        action: "accept",
        consent_text_hash: "a".repeat(64),
        consent_version: "1.0",
        ip: "127.0.0.1",
        user_agent: "vitest",
      })
      expect(error, `insert error: ${error?.message}`).toBeNull()
    })

    it("consent records timestamp in timestamptz", async () => {
      const { data } = await patientClient
        .from("consents")
        .select("occurred_at")
        .eq("patient_id", patientRecordId)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .single()

      expect(data).toBeTruthy()
      const ts = new Date(data!.occurred_at)
      expect(ts.getTime()).not.toBeNaN()
      expect(Date.now() - ts.getTime()).toBeLessThan(60_000)
    })

    it("UPDATE on consents is blocked by trigger", async () => {
      // Consents table has REVOKE ALL for UPDATE on authenticated,
      // AND a trigger that blocks UPDATE. We use service_role
      // to bypass grants and test the trigger directly.
      const { data: existing } = await serviceRole
        .from("consents")
        .select("id")
        .eq("patient_id", patientRecordId)
        .limit(1)
        .single()

      if (existing) {
        const { error } = await serviceRole
          .from("consents")
          .update({ action: "revoke" })
          .eq("id", existing.id)

        // Trigger blocks even service_role
        expect(error).not.toBeNull()
      }
    })

    it("DELETE on consents is blocked by trigger", async () => {
      const { data: existing } = await serviceRole
        .from("consents")
        .select("id")
        .eq("patient_id", patientRecordId)
        .limit(1)
        .single()

      if (existing) {
        const { error } = await serviceRole
          .from("consents")
          .delete()
          .eq("id", existing.id)

        // Trigger blocks even service_role
        expect(error).not.toBeNull()
      }
    })

    it("patient can INSERT revocation (new row, not update)", async () => {
      const { error } = await patientClient.from("consents").insert({
        patient_id: patientRecordId,
        purpose: "communication",
        action: "revoke",
        consent_text_hash: "revoked",
        consent_version: "1.0",
        ip: "127.0.0.1",
        user_agent: "vitest",
      })
      expect(error, `insert error: ${error?.message}`).toBeNull()
    })

    it("consent stores purpose, hash, version, occurred_at, ip, user_agent", async () => {
      const { data } = await patientClient
        .from("consents")
        .select(
          "purpose, consent_text_hash, consent_version, occurred_at, ip, user_agent",
        )
        .eq("patient_id", patientRecordId)
        .eq("purpose", "online_therapy")
        .limit(1)
        .single()

      expect(data).toBeTruthy()
      expect(data!.purpose).toBe("online_therapy")
      expect(data!.consent_text_hash).toHaveLength(64)
      expect(data!.consent_version).toBe("1.0")
      expect(data!.occurred_at).toBeTruthy()
    })
  },
)

// ================================================================
// 5. TOKEN SECURITY (consume_email_token RPC)
// ================================================================
describe.runIf(canRun)(
  "5. acceptInvite token security",
  () => {
    let psych: TestUser

    beforeAll(async () => {
      serviceRole = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      psych = await createTestUser("psychologist", "invite-psych")
    })

    afterAll(async () => {
      await cleanupTestPatients()
      await cleanupTestUsers()
    })

    async function createPatientWithToken(
      prefix: string,
      overrides: {
        expires_at?: string
        used_at?: string
      } = {},
    ): Promise<{
      patientId: string
      rawToken: string
      tokenHash: string
    }> {
      // Create a unique auth user for each patient (user_id is UNIQUE)
      const patientUser = await createTestUser("patient", `tok-${prefix}`)
      await new Promise((r) => setTimeout(r, 500))

      const patientId = randomUUID()
      const envelope = encrypt("tok-cpf", patientId, "cpf")
      const hmac = computeCpfBlindIndex(`invite-${prefix}-${randomUUID()}`)

      const { error: patientErr } = await serviceRole.from("patients").insert({
        id: patientId,
        user_id: patientUser.id,
        psychologist_id: psych.id,
        full_name: `QA3 ${prefix}`,
        email: patientUser.email,
        date_of_birth: adultDob(),
        cpf_ciphertext: hexToBytea(envelope.contentCiphertext),
        cpf_iv: hexToBytea(envelope.contentIv),
        cpf_tag: hexToBytea(envelope.contentTag),
        cpf_dek_wrapped: hexToBytea(envelope.dekWrapped),
        cpf_dek_iv: hexToBytea(envelope.dekIv),
        cpf_dek_tag: hexToBytea(envelope.dekTag),
        cpf_kek_version: envelope.kekVersion,
        cpf_hmac: hmac,
        status: "invited",
      })
      expect(patientErr, `patient insert: ${patientErr?.message}`).toBeNull()
      TEST_PATIENTS.push(patientId)

      const rawToken = randomUUID() + randomUUID()
      const tokenHash = createHash("sha256").update(rawToken).digest("hex")

      const { error } = await serviceRole
        .from("email_action_tokens")
        .insert({
          token_hash: tokenHash,
          purpose: "invite",
          patient_id: patientId,
          expires_at:
            overrides.expires_at ??
            new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        })
      expect(error, `token insert error: ${error?.message}`).toBeNull()

      if (overrides.used_at) {
        await serviceRole
          .from("email_action_tokens")
          .update({ used_at: overrides.used_at })
          .eq("token_hash", tokenHash)
      }

      return { patientId, rawToken, tokenHash }
    }

    it("valid token: consume_email_token returns patient_id", async () => {
      const { rawToken, patientId } =
        await createPatientWithToken("valid")
      const hash = createHash("sha256").update(rawToken).digest("hex")

      const { data, error } = await serviceRole.rpc("consume_email_token", {
        p_token_hash: hash,
        p_expected_purpose: "invite",
      })

      expect(error).toBeNull()
      const row = Array.isArray(data) ? data[0] : data
      expect(row.patient_id).toBe(patientId)
    })

    it("invalid token hash: RPC raises exception", async () => {
      const fakeHash = createHash("sha256")
        .update("nonexistent-" + randomUUID())
        .digest("hex")

      const { error } = await serviceRole.rpc("consume_email_token", {
        p_token_hash: fakeHash,
        p_expected_purpose: "invite",
      })

      expect(error).not.toBeNull()
    })

    it("expired token: RPC raises exception", async () => {
      const patientId = randomUUID()
      const envelope = encrypt("exp-cpf", patientId, "cpf")
      const hmac = computeCpfBlindIndex("expired-" + randomUUID())

      await serviceRole.from("patients").insert({
        id: patientId,
        user_id: null,
        psychologist_id: psych.id,
        full_name: "QA3 Expired",
        email: testEmail("exp"),
        date_of_birth: adultDob(),
        cpf_ciphertext: hexToBytea(envelope.contentCiphertext),
        cpf_iv: hexToBytea(envelope.contentIv),
        cpf_tag: hexToBytea(envelope.contentTag),
        cpf_dek_wrapped: hexToBytea(envelope.dekWrapped),
        cpf_dek_iv: hexToBytea(envelope.dekIv),
        cpf_dek_tag: hexToBytea(envelope.dekTag),
        cpf_kek_version: envelope.kekVersion,
        cpf_hmac: hmac,
        status: "invited",
      })
      TEST_PATIENTS.push(patientId)

      const rawToken = randomUUID() + randomUUID()
      const tokenHash = createHash("sha256").update(rawToken).digest("hex")

      // Insert with future expiry, then immediately update expires_at to the past
      await serviceRole.from("email_action_tokens").insert({
        token_hash: tokenHash,
        purpose: "invite",
        patient_id: patientId,
        expires_at: new Date(Date.now() + 60000).toISOString(),
      })

      // Set to past via direct update
      await serviceRole
        .from("email_action_tokens")
        .update({ expires_at: new Date(Date.now() - 60000).toISOString() })
        .eq("token_hash", tokenHash)

      const { error } = await serviceRole.rpc("consume_email_token", {
        p_token_hash: tokenHash,
        p_expected_purpose: "invite",
      })

      expect(error).not.toBeNull()
      expect(error!.message.toLowerCase()).toContain("expired")
    })

    it("already-used token: RPC raises exception", async () => {
      const { rawToken } = await createPatientWithToken("used", {
        used_at: new Date().toISOString(),
      })
      const hash = createHash("sha256").update(rawToken).digest("hex")

      const { error } = await serviceRole.rpc("consume_email_token", {
        p_token_hash: hash,
        p_expected_purpose: "invite",
      })

      expect(error).not.toBeNull()
      expect(error!.message.toLowerCase()).toContain("already used")
    })

    it("token is consumed atomically (second consume fails)", async () => {
      const { rawToken } = await createPatientWithToken("atomic")
      const hash = createHash("sha256").update(rawToken).digest("hex")

      // First consume
      const { error: err1 } = await serviceRole.rpc("consume_email_token", {
        p_token_hash: hash,
        p_expected_purpose: "invite",
      })
      expect(err1).toBeNull()

      // Second consume of SAME token
      const { error: err2 } = await serviceRole.rpc("consume_email_token", {
        p_token_hash: hash,
        p_expected_purpose: "invite",
      })
      expect(err2).not.toBeNull()
      expect(err2!.message.toLowerCase()).toContain("already used")
    })

    it("token_hash is stored, never the raw token", async () => {
      const { rawToken, tokenHash } =
        await createPatientWithToken("raw-check")

      // Search for raw token — should not exist
      const { data } = await serviceRole
        .from("email_action_tokens")
        .select("token_hash")
        .eq("token_hash", rawToken)
        .maybeSingle()
      expect(data).toBeNull()

      // But the hash exists
      const { data: hashData } = await serviceRole
        .from("email_action_tokens")
        .select("token_hash")
        .eq("token_hash", tokenHash)
        .maybeSingle()
      expect(hashData).not.toBeNull()
    })
  },
)

// ================================================================
// 6. RLS: Patient isolation
// ================================================================
describe.runIf(canRun)(
  "6. RLS: patient reads own data, blocked from others",
  () => {
    let psych: TestUser
    let patientA: TestUser
    let patientB: TestUser
    let patientRecordA: string
    let patientRecordB: string
    let clientA: SupabaseClient
    let clientB: SupabaseClient

    beforeAll(async () => {
      serviceRole = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      psych = await createTestUser("psychologist", "rls-psych")
      await new Promise((r) => setTimeout(r, 2000))
      patientA = await createTestUser("patient", "rls-patA")
      await new Promise((r) => setTimeout(r, 2000))
      patientB = await createTestUser("patient", "rls-patB")

      patientRecordA = randomUUID()
      const envA = encrypt("rls-a", patientRecordA, "cpf")
      const hmacA = computeCpfBlindIndex("rls-a-" + randomUUID())
      await serviceRole.from("patients").insert({
        id: patientRecordA,
        user_id: patientA.id,
        psychologist_id: psych.id,
        full_name: "QA3 RLS PatA",
        email: patientA.email,
        date_of_birth: adultDob(),
        cpf_ciphertext: hexToBytea(envA.contentCiphertext),
        cpf_iv: hexToBytea(envA.contentIv),
        cpf_tag: hexToBytea(envA.contentTag),
        cpf_dek_wrapped: hexToBytea(envA.dekWrapped),
        cpf_dek_iv: hexToBytea(envA.dekIv),
        cpf_dek_tag: hexToBytea(envA.dekTag),
        cpf_kek_version: envA.kekVersion,
        cpf_hmac: hmacA,
        status: "active",
      })
      TEST_PATIENTS.push(patientRecordA)

      patientRecordB = randomUUID()
      const envB = encrypt("rls-b", patientRecordB, "cpf")
      const hmacB = computeCpfBlindIndex("rls-b-" + randomUUID())
      await serviceRole.from("patients").insert({
        id: patientRecordB,
        user_id: patientB.id,
        psychologist_id: psych.id,
        full_name: "QA3 RLS PatB",
        email: patientB.email,
        date_of_birth: adultDob(),
        cpf_ciphertext: hexToBytea(envB.contentCiphertext),
        cpf_iv: hexToBytea(envB.contentIv),
        cpf_tag: hexToBytea(envB.contentTag),
        cpf_dek_wrapped: hexToBytea(envB.dekWrapped),
        cpf_dek_iv: hexToBytea(envB.dekIv),
        cpf_dek_tag: hexToBytea(envB.dekTag),
        cpf_kek_version: envB.kekVersion,
        cpf_hmac: hmacB,
        status: "active",
      })
      TEST_PATIENTS.push(patientRecordB)

      // Insert consent for patient A via patient's own client
      // (service_role inserts fail if ip is NOT NULL and not provided)
      const tempClientA = await signIn(patientA)
      await tempClientA.from("consents").insert({
        patient_id: patientRecordA,
        purpose: "online_therapy",
        action: "accept",
        consent_text_hash: "b".repeat(64),
        consent_version: "1.0",
        ip: "127.0.0.1",
        user_agent: "vitest",
      })

      await new Promise((r) => setTimeout(r, 2000))
      clientA = await signIn(patientA)
      await new Promise((r) => setTimeout(r, 1500))
      clientB = await signIn(patientB)
    })

    afterAll(async () => {
      await cleanupTestPatients()
      await cleanupTestUsers()
    })

    it("patient A reads own patient record", async () => {
      const { data, error } = await clientA
        .from("patients")
        .select("id, full_name")
        .eq("id", patientRecordA)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(patientRecordA)
    })

    it("patient A does NOT see patient B record", async () => {
      const { data } = await clientA
        .from("patients")
        .select("id")
        .eq("id", patientRecordB)

      expect(data).toHaveLength(0)
    })

    it("patient A reads own profile", async () => {
      const { data, error } = await clientA
        .from("profiles")
        .select("id, role")
        .eq("id", patientA.id)
        .single()

      expect(error).toBeNull()
      expect(data!.role).toBe("patient")
    })

    it("patient A reads own consents", async () => {
      const { data } = await clientA
        .from("consents")
        .select("purpose, action")
        .eq("patient_id", patientRecordA)

      expect(data!.length).toBeGreaterThanOrEqual(1)
    })

    it("patient A does NOT read patient B consents", async () => {
      const { data } = await clientA
        .from("consents")
        .select("purpose")
        .eq("patient_id", patientRecordB)

      expect(data).toHaveLength(0)
    })

    it("patient cannot read clinical_records", async () => {
      const { data } = await clientA
        .from("clinical_records")
        .select("id")

      expect(data).toHaveLength(0)
    })

    it("patient cannot INSERT into patients", async () => {
      const { error } = await clientA.from("patients").insert({
        id: randomUUID(),
        user_id: patientA.id,
        psychologist_id: psych.id,
        full_name: "Hack attempt",
        email: "hack@test.com",
        date_of_birth: adultDob(),
        cpf_ciphertext: hexToBytea("00"),
        cpf_iv: hexToBytea("00"),
        cpf_tag: hexToBytea("00"),
        cpf_dek_wrapped: hexToBytea("00"),
        cpf_dek_iv: hexToBytea("00"),
        cpf_dek_tag: hexToBytea("00"),
        cpf_hmac: "fake",
        status: "active",
      })

      expect(error).not.toBeNull()
    })

    it("patient cannot read cpf_ciphertext column (column-level grant)", async () => {
      const { error } = await clientA
        .from("patients")
        .select("cpf_ciphertext")
        .eq("id", patientRecordA)

      expect(error).not.toBeNull()
      expect(error!.code).toBe("42501")
    })
  },
)

// ================================================================
// 7. Column-level grants
// ================================================================
describe.runIf(canRun)(
  "7. Column-level grants: cipher columns blocked for authenticated",
  () => {
    let psych: TestUser
    let psychClient: SupabaseClient

    beforeAll(async () => {
      serviceRole = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      await new Promise((r) => setTimeout(r, 2000))
      psych = await createTestUser("psychologist", "colg-psych")
      await new Promise((r) => setTimeout(r, 1500))
      psychClient = await signIn(psych)
    })

    afterAll(async () => {
      await cleanupTestUsers()
    })

    it("psychologist cannot SELECT cpf_ciphertext from patients", async () => {
      const { error } = await psychClient
        .from("patients")
        .select("cpf_ciphertext")

      expect(error).not.toBeNull()
      expect(error!.code).toBe("42501")
    })

    it("psychologist cannot SELECT cpf_hmac from patients", async () => {
      const { error } = await psychClient
        .from("patients")
        .select("cpf_hmac")

      expect(error).not.toBeNull()
      expect(error!.code).toBe("42501")
    })

    it("psychologist CAN SELECT non-cipher columns from patients", async () => {
      const { error } = await psychClient
        .from("patients")
        .select("id, full_name, email, status, date_of_birth")

      expect(error).toBeNull()
    })
  },
)

// ================================================================
// 8. Psychologist reads patients and consents
// ================================================================
describe.runIf(canRun)(
  "8. Psychologist reads patients and consents",
  () => {
    let psych: TestUser
    let patient: TestUser
    let patientId: string
    let psychClient: SupabaseClient

    beforeAll(async () => {
      serviceRole = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      await new Promise((r) => setTimeout(r, 2000))
      psych = await createTestUser("psychologist", "read-psych")
      await new Promise((r) => setTimeout(r, 2000))
      patient = await createTestUser("patient", "read-pat")

      patientId = randomUUID()
      const envelope = encrypt("read-cpf", patientId, "cpf")
      const hmac = computeCpfBlindIndex("read-" + randomUUID())

      await serviceRole.from("patients").insert({
        id: patientId,
        user_id: patient.id,
        psychologist_id: psych.id,
        full_name: "QA3 Readable Patient",
        email: patient.email,
        date_of_birth: adultDob(),
        cpf_ciphertext: hexToBytea(envelope.contentCiphertext),
        cpf_iv: hexToBytea(envelope.contentIv),
        cpf_tag: hexToBytea(envelope.contentTag),
        cpf_dek_wrapped: hexToBytea(envelope.dekWrapped),
        cpf_dek_iv: hexToBytea(envelope.dekIv),
        cpf_dek_tag: hexToBytea(envelope.dekTag),
        cpf_kek_version: envelope.kekVersion,
        cpf_hmac: hmac,
        status: "active",
      })
      TEST_PATIENTS.push(patientId)

      // Insert consent via patient's own session (service_role fails on ip NOT NULL)
      const tempPatClient = await signIn(patient)
      const { error: consentErr } = await tempPatClient.from("consents").insert({
        patient_id: patientId,
        purpose: "lgpd_clinical",
        action: "accept",
        consent_text_hash: "c".repeat(64),
        consent_version: "1.0",
        ip: "127.0.0.1",
        user_agent: "vitest",
      })
      if (consentErr) {
        // If patient can't insert, fall back to service_role with ip
        await serviceRole.from("consents").insert({
          patient_id: patientId,
          purpose: "lgpd_clinical",
          action: "accept",
          consent_text_hash: "c".repeat(64),
          consent_version: "1.0",
          ip: "127.0.0.1",
          user_agent: "vitest",
        })
      }

      await new Promise((r) => setTimeout(r, 1500))
      psychClient = await signIn(psych)
    })

    afterAll(async () => {
      await cleanupTestPatients()
      await cleanupTestUsers()
    })

    it("psychologist sees her patients", async () => {
      const { data, error } = await psychClient
        .from("patients")
        .select("id, full_name, status")
        .eq("id", patientId)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].full_name).toBe("QA3 Readable Patient")
    })

    it("psychologist sees patient consents", async () => {
      const { data, error } = await psychClient
        .from("consents")
        .select("purpose, action")
        .eq("patient_id", patientId)

      expect(error).toBeNull()
      expect(data!.length).toBeGreaterThanOrEqual(1)
    })
  },
)
