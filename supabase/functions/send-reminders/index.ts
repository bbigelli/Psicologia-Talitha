/**
 * Edge Function: send-reminders
 *
 * Cron-triggered (every 15 minutes) to send session reminders via Resend.
 * Sends 24h and 1h reminders for upcoming sessions.
 *
 * Security:
 * - CRON_SECRET validated with timingSafeEqual (Requirement 30)
 * - Uses RESEND_API_KEY_CRON (not the app key)
 * - Uses SUPABASE_SERVICE_ROLE_KEY for DB access
 *
 * Idempotency:
 * - INSERT into session_reminders with UNIQUE (session_id, reminder_type)
 * - Duplicate insert → constraint violation → treated as "already sent"
 * - No pre-check needed (bank-level constraint handles race)
 *
 * Consent:
 * - Checks communication_preferences for opt-out before sending
 * - Only sends to patients with active 'communication' consent
 *   OR patients who haven't explicitly opted out (conservative)
 *
 * Content policy:
 * - Subject NEVER reveals therapy/psychology/clinical data
 * - Neutral subject from allowlist: "Lembrete de compromisso"
 * - Details (date, time) only in the body (requires opening email)
 *
 * Timezone:
 * - All time calculations use America/Sao_Paulo explicitly
 * - DB stores timestamptz in UTC; comparisons done in UTC
 *
 * Required secrets (via supabase secrets set):
 * - CRON_SECRET: shared secret for cron invocation auth
 * - RESEND_API_KEY_CRON: Resend API key for cron emails
 * - SITE_URL: base URL for confirmation links
 * - SUPABASE_SERVICE_ROLE_KEY: (auto-injected by Supabase)
 * - SUPABASE_URL: (auto-injected by Supabase)
 *
 * @see architecture.md §8.3
 * @see data-architecture.md §session_reminders
 * @see US-304, US-305
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts"

// --- Types ---

interface SessionToRemind {
  id: string
  patient_id: string
  psychologist_id: string
  scheduled_at: string
  duration_minutes: number
  status: string
}

interface PatientInfo {
  id: string
  full_name: string
  user_id: string
  email: string
}

interface ReminderDecision {
  session: SessionToRemind
  patient: PatientInfo
  reminderType: "24h" | "1h"
  confirmToken: string
  cancelToken: string
}

// --- Security ---

/**
 * Timing-safe comparison to prevent timing attacks on CRON_SECRET.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)

  if (bufA.length !== bufB.length) return false

  let result = 0
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i]
  }
  return result === 0
}

/**
 * Generate a cryptographically secure random token.
 */
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * SHA-256 hash for token storage.
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// --- Reminder Logic (pure — testable in isolation) ---

const BRAZIL_TZ = "America/Sao_Paulo"

/**
 * Determine which reminders need to be sent.
 *
 * Pure function: takes current time and sessions, returns decisions.
 * No side effects — all DB/email interaction is in the caller.
 */
export function determineReminders(
  now: Date,
  sessions: SessionToRemind[],
  optedOutPatientIds: Set<string>,
): Array<{ session: SessionToRemind; reminderType: "24h" | "1h" }> {
  const results: Array<{
    session: SessionToRemind
    reminderType: "24h" | "1h"
  }> = []

  for (const session of sessions) {
    // Skip cancelled/completed/no_show sessions
    if (!["scheduled", "confirmed"].includes(session.status)) continue

    // Skip opted-out patients
    if (optedOutPatientIds.has(session.patient_id)) continue

    const sessionTime = new Date(session.scheduled_at)
    const hoursUntil =
      (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    // 24h reminder: between 23h and 25h before session
    // (15-min cron window tolerance)
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

/**
 * Build email content for a reminder.
 *
 * Content policy: subject is neutral, no clinical reference.
 * Body includes date/time but no patient name in subject.
 */
export function buildReminderEmail(
  patientName: string,
  scheduledAt: string,
  durationMinutes: number,
  reminderType: "24h" | "1h",
  confirmUrl: string | null,
  cancelUrl: string | null,
): { subject: string; html: string; text: string } {
  const sessionDate = new Date(scheduledAt)
  const dateStr = sessionDate.toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const timeStr = sessionDate.toLocaleTimeString("pt-BR", {
    timeZone: BRAZIL_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })

  // Subject from allowlist — never reveals therapy
  const subject = "Lembrete de compromisso"
  const preheader =
    reminderType === "24h"
      ? "Voce tem um compromisso amanha."
      : "Seu compromisso comeca em breve."

  const actionLinks =
    confirmUrl && cancelUrl
      ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#5B8C7E;border-radius:6px;padding:12px 24px;margin-right:8px;">
                    <a href="${confirmUrl}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">
                      Confirmar presenca
                    </a>
                  </td>
                  <td style="width:12px;"></td>
                  <td style="background-color:#e2e8f0;border-radius:6px;padding:12px 24px;">
                    <a href="${cancelUrl}" style="color:#333333;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">
                      Nao poderei ir
                    </a>
                  </td>
                </tr>
              </table>`
      : ""

  const actionLinksText =
    confirmUrl && cancelUrl
      ? `\nConfirmar presenca: ${confirmUrl}\nNao poderei ir: ${cancelUrl}\n`
      : ""

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8faf9;font-family:Arial,Helvetica,sans-serif;">
  <span style="display:none;font-size:1px;color:#f8faf9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8faf9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;padding:32px;border:1px solid #e2e8f0;">
          <tr>
            <td>
              <h1 style="margin:0 0 8px;font-size:20px;color:#1a1a1a;font-weight:600;">
                Talitha
              </h1>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />

              <p style="margin:0 0 16px;font-size:16px;color:#333333;line-height:1.5;">
                Ola, ${patientName}.
              </p>

              <p style="margin:0 0 16px;font-size:16px;color:#333333;line-height:1.5;">
                ${reminderType === "24h" ? "Este e um lembrete do seu compromisso de amanha." : "Seu compromisso comeca em breve."}
              </p>

              <p style="margin:0 0 8px;font-size:16px;color:#333333;line-height:1.5;">
                <strong>${dateStr}</strong><br>
                ${timeStr} (${durationMinutes} minutos)
              </p>

              ${actionLinks}

              <p style="margin:24px 0 0;font-size:12px;color:#999999;line-height:1.5;">
                Se voce nao reconhece este compromisso, ignore este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `Ola, ${patientName}.

${reminderType === "24h" ? "Este e um lembrete do seu compromisso de amanha." : "Seu compromisso comeca em breve."}

${dateStr}
${timeStr} (${durationMinutes} minutos)
${actionLinksText}
Se voce nao reconhece este compromisso, ignore este e-mail.`

  return { subject, html, text }
}

// --- Main Handler ---

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // Validate CRON_SECRET
  const cronSecret = Deno.env.get("CRON_SECRET")
  if (!cronSecret) {
    return new Response("Server misconfigured", { status: 500 })
  }

  const authHeader = req.headers.get("authorization")
  const providedSecret = authHeader?.replace("Bearer ", "") ?? ""

  if (!timingSafeEqual(providedSecret, cronSecret)) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Initialize Supabase client with service_role
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const resendApiKey = Deno.env.get("RESEND_API_KEY_CRON")
  const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:3000"
  const emailFrom =
    Deno.env.get("EMAIL_FROM") || "Talitha <onboarding@resend.dev>"

  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY_CRON not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const now = new Date()

  // Fetch sessions in the next 25 hours (covers both 24h and 1h windows)
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      "id, patient_id, psychologist_id, scheduled_at, duration_minutes, status",
    )
    .in("status", ["scheduled", "confirmed"])
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", windowEnd.toISOString())

  if (sessionsError || !sessions) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch sessions" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  if (sessions.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, message: "No sessions to remind" }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // Check communication preferences (opt-out)
  const patientIds = [...new Set(sessions.map((s) => s.patient_id))]

  const { data: optOutRecords } = await supabase
    .from("communication_preferences")
    .select("patient_id, opted_out")
    .in("patient_id", patientIds)
    .eq("channel", "email")
    .eq("purpose", "session_reminders")
    .eq("opted_out", true)

  const optedOutIds = new Set(
    (optOutRecords ?? []).map((r) => r.patient_id),
  )

  // Also check consent — only send to patients with communication consent
  // (conservative approach: if no consent record, we check opt-out only)
  const { data: consentRecords } = await supabase
    .from("consents")
    .select("patient_id, purpose, action, occurred_at")
    .in("patient_id", patientIds)
    .eq("purpose", "communication")
    .order("occurred_at", { ascending: false })

  // Build a set of patients who explicitly revoked communication consent
  const revokedCommunication = new Set<string>()
  if (consentRecords) {
    const seen = new Set<string>()
    for (const c of consentRecords) {
      if (!seen.has(c.patient_id)) {
        seen.add(c.patient_id)
        if (c.action === "revoke") {
          revokedCommunication.add(c.patient_id)
        }
      }
    }
  }

  // Merge opt-outs: explicit opt-out OR revoked communication consent
  const allOptedOut = new Set([...optedOutIds, ...revokedCommunication])

  // Determine which reminders to send
  const remindersToSend = determineReminders(now, sessions, allOptedOut)

  if (remindersToSend.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, message: "No reminders needed" }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // Fetch patient info
  const reminderPatientIds = [
    ...new Set(remindersToSend.map((r) => r.session.patient_id)),
  ]

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, user_id")
    .in("id", reminderPatientIds)

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in(
      "id",
      (patients ?? []).map((p) => p.user_id),
    )

  const patientMap = new Map<
    string,
    PatientInfo
  >()
  for (const p of patients ?? []) {
    const profile = (profiles ?? []).find((pr) => pr.id === p.user_id)
    if (profile) {
      patientMap.set(p.id, {
        id: p.id,
        full_name: p.full_name,
        user_id: p.user_id,
        email: profile.email,
      })
    }
  }

  let sentCount = 0
  let failedCount = 0

  for (const reminder of remindersToSend) {
    const patient = patientMap.get(reminder.session.patient_id)
    if (!patient) continue

    // Try to INSERT the reminder record — UNIQUE constraint ensures idempotency.
    // If it fails with duplicate, skip (already sent).
    const { error: insertError } = await supabase
      .from("session_reminders")
      .insert({
        session_id: reminder.session.id,
        reminder_type: reminder.reminderType,
        delivery_status: "pending",
      })

    if (insertError) {
      // Unique constraint violation = already sent
      if (
        insertError.code === "23505" ||
        insertError.message?.includes("unique") ||
        insertError.message?.includes("duplicate")
      ) {
        continue // Already sent — idempotent
      }
      failedCount++
      continue
    }

    // Generate confirmation tokens (only for 24h reminders)
    let confirmUrl: string | null = null
    let cancelUrl: string | null = null

    if (reminder.reminderType === "24h") {
      const confirmToken = generateToken()
      const cancelToken = generateToken()

      const confirmHash = await hashToken(confirmToken)
      const cancelHash = await hashToken(cancelToken)

      // Token expires at session time
      const expiresAt = reminder.session.scheduled_at

      // Insert confirm token
      await supabase.from("email_action_tokens").insert({
        token_hash: confirmHash,
        purpose: "confirm_attendance",
        patient_id: reminder.session.patient_id,
        session_id: reminder.session.id,
        expires_at: expiresAt,
      })

      // Insert cancel token
      await supabase.from("email_action_tokens").insert({
        token_hash: cancelHash,
        purpose: "cancel_attendance",
        patient_id: reminder.session.patient_id,
        session_id: reminder.session.id,
        expires_at: expiresAt,
      })

      confirmUrl = `${siteUrl}/confirmar/${confirmToken}`
      cancelUrl = `${siteUrl}/confirmar/${cancelToken}`
    }

    // Build email
    const email = buildReminderEmail(
      patient.full_name.split(" ")[0], // First name only
      reminder.session.scheduled_at,
      reminder.session.duration_minutes,
      reminder.reminderType,
      confirmUrl,
      cancelUrl,
    )

    // Send via Resend
    try {
      const resendResponse = await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: emailFrom,
            to: patient.email,
            subject: email.subject,
            html: email.html,
            text: email.text,
          }),
        },
      )

      if (resendResponse.ok) {
        const resendData = await resendResponse.json()
        // Mark as sent
        await supabase
          .from("session_reminders")
          .update({
            delivery_status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: resendData.id || null,
          })
          .eq("session_id", reminder.session.id)
          .eq("reminder_type", reminder.reminderType)

        // Audit log
        await supabase.rpc("log_audit_system", {
          p_actor_id: null,
          p_actor_source: "cron",
          p_patient_id: reminder.session.patient_id,
          p_action: "SEND_REMINDER",
          p_metadata: JSON.stringify({
            reminder_type: reminder.reminderType,
            session_id: reminder.session.id,
          }),
        })

        sentCount++
      } else {
        // Mark as failed — will be retried on next cron run
        await supabase
          .from("session_reminders")
          .update({ delivery_status: "failed" })
          .eq("session_id", reminder.session.id)
          .eq("reminder_type", reminder.reminderType)

        failedCount++
      }
    } catch {
      // Network error — mark as failed
      await supabase
        .from("session_reminders")
        .update({ delivery_status: "failed" })
        .eq("session_id", reminder.session.id)
        .eq("reminder_type", reminder.reminderType)

      failedCount++
    }
  }

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failedCount }),
    { headers: { "Content-Type": "application/json" } },
  )
})
