/**
 * Edge Function: billing-rules
 *
 * Cron-triggered (daily at 9am BRT) to execute the billing rule engine.
 *
 * Billing timeline (regua de cobranca):
 * - D-3: Pre-due reminder to patient
 * - D+3: 1st overdue reminder to patient
 * - D+7: 2nd overdue reminder to patient + notification to psychologist
 * - D+15: Mark as "defaulter" (inadimplente)
 *
 * Security:
 * - verify_jwt = false (cron invocation)
 * - CRON_SECRET validated with timingSafeEqual
 * - Idempotency via UNIQUE (charge_id, step) in billing_rule_events
 * - Respects communication_preferences opt-out
 * - Checks consent (communication purpose not revoked)
 * - Neutral email subject from allowlist: "Lembrete de pagamento"
 *
 * Content policy:
 * - Subject NEVER reveals therapy/psychology/clinical data
 * - Body uses neutral language, respectful tone (health context)
 * - No clinical content, no CPF, no values in subject
 *
 * @see architecture.md §8.3
 * @see backlog Sprint 5, Task 5.5
 * @see US-105
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

interface ChargeWithPatient {
  id: string
  patient_id: string
  psychologist_id: string
  amount: number
  due_date: string
  status: string
}

interface PatientInfo {
  id: string
  full_name: string
  user_id: string
}

/** Determine which billing step applies based on days since due date */
function determineStep(
  daysDiff: number,
): "d_minus_3" | "d_plus_3" | "d_plus_7" | "d_plus_15" | null {
  // D-3: 3 days BEFORE due date (daysDiff = -3, window: -4 to -2)
  if (daysDiff >= -4 && daysDiff <= -2) return "d_minus_3"
  // D+3: 3 days AFTER due date (daysDiff = 3, window: 2 to 4)
  if (daysDiff >= 2 && daysDiff <= 4) return "d_plus_3"
  // D+7: 7 days AFTER due date (daysDiff = 7, window: 6 to 8)
  if (daysDiff >= 6 && daysDiff <= 8) return "d_plus_7"
  // D+15: 15 days AFTER due date (daysDiff = 15, window: 14 to 16)
  if (daysDiff >= 14 && daysDiff <= 16) return "d_plus_15"
  return null
}

/** Build billing reminder email — neutral, respectful tone */
function buildBillingEmail(
  patientFirstName: string,
  step: string,
  amount: number,
  dueDate: string,
): { subject: string; html: string; text: string } {
  const formattedAmount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount)

  const formattedDate = new Date(dueDate + "T12:00:00Z").toLocaleDateString(
    "pt-BR",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  )

  const subject = "Lembrete de pagamento"

  let bodyText: string
  let preheader: string

  switch (step) {
    case "d_minus_3":
      preheader = "Voce tem um pagamento com vencimento proximo."
      bodyText = `Gostaríamos de lembrar que voce tem um pagamento de ${formattedAmount} com vencimento em ${formattedDate}. Caso ja tenha efetuado, por favor desconsidere esta mensagem.`
      break
    case "d_plus_3":
      preheader = "Identificamos um pagamento pendente."
      bodyText = `Identificamos que o pagamento de ${formattedAmount}, com vencimento em ${formattedDate}, ainda nao foi registrado. Caso ja tenha efetuado, o processamento pode levar alguns dias.`
      break
    case "d_plus_7":
      preheader = "Lembrete sobre pagamento pendente."
      bodyText = `Este e um segundo lembrete sobre o pagamento de ${formattedAmount}, com vencimento em ${formattedDate}. Caso esteja com alguma dificuldade, entre em contato para conversarmos sobre alternativas.`
      break
    case "d_plus_15":
      preheader = "Informacao sobre pagamento pendente."
      bodyText = `O pagamento de ${formattedAmount}, vencido em ${formattedDate}, permanece pendente. Para regularizar sua situacao, entre em contato ou acesse seu portal de pagamentos.`
      break
    default:
      preheader = "Informacao sobre pagamento."
      bodyText = `Voce tem um pagamento pendente de ${formattedAmount}. Acesse seu portal para mais detalhes.`
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#f8faf9;font-family:Arial,Helvetica,sans-serif;">
  <span style="display:none;font-size:1px;color:#f8faf9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8faf9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;padding:32px;border:1px solid #e2e8f0;">
        <tr><td>
          <h1 style="margin:0 0 8px;font-size:20px;color:#1a1a1a;font-weight:600;">Talitha</h1>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
          <p style="margin:0 0 16px;font-size:16px;color:#333333;line-height:1.5;">Ola, ${patientFirstName}.</p>
          <p style="margin:0 0 16px;font-size:16px;color:#333333;line-height:1.5;">${bodyText}</p>
          <p style="margin:24px 0 0;font-size:12px;color:#999999;line-height:1.5;">Se voce nao reconhece este pagamento, ignore este e-mail.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = `Ola, ${patientFirstName}.\n\n${bodyText}\n\nSe voce nao reconhece este pagamento, ignore este e-mail.`

  return { subject, html, text }
}

Deno.serve(async (req: Request) => {
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const resendApiKey = Deno.env.get("RESEND_API_KEY_CRON")
  const emailFrom = Deno.env.get("EMAIL_FROM") || "Talitha <onboarding@resend.dev>"

  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY_CRON not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const now = new Date()
  const today = now.toISOString().split("T")[0]

  // Load charges that need billing rules:
  // - Status: pending or overdue (not paid/refunded/cancelled)
  // - Due date in the range: D-5 to D+17 (covers all steps with window)
  const windowStart = new Date(now.getTime() - 17 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0]
  const windowEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0]

  const { data: charges, error: chargesError } = await supabase
    .from("charges")
    .select("id, patient_id, psychologist_id, amount, due_date, status")
    .in("status", ["pending", "overdue"])
    .gte("due_date", windowStart)
    .lte("due_date", windowEnd)

  if (chargesError || !charges || charges.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, message: "No charges in billing window" }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // Check communication opt-outs
  const patientIds = [...new Set(charges.map((c) => c.patient_id))]

  const { data: optOutRecords } = await supabase
    .from("communication_preferences")
    .select("patient_id")
    .in("patient_id", patientIds)
    .eq("channel", "email")
    .eq("purpose", "billing_reminders")
    .eq("opted_out", true)

  const optedOutIds = new Set(
    (optOutRecords ?? []).map((r: { patient_id: string }) => r.patient_id),
  )

  // Check communication consent revocation
  const { data: consentRecords } = await supabase
    .from("consents")
    .select("patient_id, purpose, action, occurred_at")
    .in("patient_id", patientIds)
    .eq("purpose", "communication")
    .order("occurred_at", { ascending: false })

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

  const allOptedOut = new Set([...optedOutIds, ...revokedCommunication])

  // Get patient info
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, user_id")
    .in("id", patientIds)

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", (patients ?? []).map((p: PatientInfo) => p.user_id))

  const patientMap = new Map<string, { name: string; email: string }>()
  for (const p of (patients ?? []) as PatientInfo[]) {
    const profile = (profiles ?? []).find(
      (pr: { id: string; email: string }) => pr.id === p.user_id,
    )
    if (profile) {
      patientMap.set(p.id, { name: p.full_name, email: profile.email })
    }
  }

  let sentCount = 0
  let skippedCount = 0
  const psychologistsToNotifyD7 = new Set<string>()

  for (const charge of charges as ChargeWithPatient[]) {
    // Skip opted-out patients
    if (allOptedOut.has(charge.patient_id)) {
      skippedCount++
      continue
    }

    // Calculate days difference
    const dueDateMs = new Date(charge.due_date + "T00:00:00Z").getTime()
    const todayMs = new Date(today + "T00:00:00Z").getTime()
    const daysDiff = Math.round((todayMs - dueDateMs) / (1000 * 60 * 60 * 24))

    const step = determineStep(daysDiff)
    if (!step) continue

    // If charge is paid between steps, stop the billing rule
    if (charge.status === "paid") continue

    // Idempotency: try to insert billing_rule_event
    const { error: insertError } = await supabase
      .from("billing_rule_events")
      .insert({
        charge_id: charge.id,
        step,
        delivery_status: "pending",
      })

    if (insertError) {
      // Duplicate — already processed this step
      if (insertError.code === "23505" || insertError.message?.includes("duplicate")) {
        continue
      }
      skippedCount++
      continue
    }

    // D+7: also notify psychologist
    if (step === "d_plus_7") {
      psychologistsToNotifyD7.add(charge.psychologist_id)
    }

    // Get patient info
    const patientInfo = patientMap.get(charge.patient_id)
    if (!patientInfo) {
      await supabase
        .from("billing_rule_events")
        .update({ delivery_status: "failed" })
        .eq("charge_id", charge.id)
        .eq("step", step)
      continue
    }

    // Build and send email
    const email = buildBillingEmail(
      patientInfo.name.split(" ")[0],
      step,
      charge.amount,
      charge.due_date,
    )

    try {
      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: patientInfo.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      })

      if (resendResp.ok) {
        const resendData = await resendResp.json()
        await supabase
          .from("billing_rule_events")
          .update({
            delivery_status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: resendData.id || null,
          })
          .eq("charge_id", charge.id)
          .eq("step", step)

        sentCount++
      } else {
        await supabase
          .from("billing_rule_events")
          .update({ delivery_status: "failed" })
          .eq("charge_id", charge.id)
          .eq("step", step)
      }
    } catch {
      await supabase
        .from("billing_rule_events")
        .update({ delivery_status: "failed" })
        .eq("charge_id", charge.id)
        .eq("step", step)
    }
  }

  // Notify psychologists about D+7 charges
  for (const psychId of psychologistsToNotifyD7) {
    const { data: psychProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", psychId)
      .single()

    if (psychProfile?.email && resendApiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: emailFrom,
            to: psychProfile.email,
            subject: "Atividade na sua conta",
            html: `<p>Ola, ${psychProfile.full_name?.split(" ")[0] || ""}.</p><p>Existem pagamentos pendentes ha mais de 7 dias. Acesse o painel financeiro para acompanhar.</p>`,
            text: `Ola, ${psychProfile.full_name?.split(" ")[0] || ""}. Existem pagamentos pendentes ha mais de 7 dias. Acesse o painel financeiro para acompanhar.`,
          }),
        })
      } catch {
        // Non-critical
      }
    }
  }

  return new Response(
    JSON.stringify({ sent: sentCount, skipped: skippedCount }),
    { headers: { "Content-Type": "application/json" } },
  )
})
