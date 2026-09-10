/**
 * Edge Function: retry-charges
 *
 * Cron-triggered (every 15 min) to retry charges stuck in pending_creation.
 *
 * Security:
 * - verify_jwt = false (cron invocation)
 * - CRON_SECRET validated with timingSafeEqual
 * - Uses SUPABASE_SERVICE_ROLE_KEY for DB access
 *
 * Logic:
 * - Loads charges with status='pending_creation', created_at > 5min and < 24h
 * - Requires asaas_customer_id (set by Server Action via manage-asaas-customer)
 * - Attempts to create payment on Asaas
 * - After 3 failures: notifies psychologist by email
 *
 * @see architecture.md §8.1
 * @see backlog Sprint 5, Task 5.1
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
  const asaasApiKey = Deno.env.get("ASAAS_API_KEY")
  const asaasBaseUrl = Deno.env.get("ASAAS_BASE_URL")
  const resendApiKey = Deno.env.get("RESEND_API_KEY_CRON")
  const emailFrom = Deno.env.get("EMAIL_FROM") || "Talitha <onboarding@resend.dev>"

  if (!asaasApiKey || !asaasBaseUrl) {
    return new Response(
      JSON.stringify({ error: "ASAAS not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const now = new Date()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Load charges stuck in pending_creation
  const { data: charges, error: queryError } = await supabase
    .from("charges")
    .select("id, patient_id, psychologist_id, amount, due_date, payment_method, asaas_customer_id, created_at")
    .eq("status", "pending_creation")
    .lte("created_at", fiveMinAgo.toISOString())
    .gte("created_at", twentyFourHoursAgo.toISOString())
    .not("asaas_customer_id", "is", null)

  if (queryError || !charges || charges.length === 0) {
    return new Response(
      JSON.stringify({ retried: 0, message: "No charges to retry" }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  let retriedCount = 0
  let failedCount = 0
  const psychologistsToNotify = new Set<string>()

  for (const charge of charges) {
    // Calculate retry count based on age
    const ageMs = now.getTime() - new Date(charge.created_at).getTime()
    const ageHours = ageMs / (1000 * 60 * 60)

    // After ~3 hours (12 retries at 15 min intervals), notify psychologist
    if (ageHours > 3) {
      psychologistsToNotify.add(charge.psychologist_id)
    }

    // Build neutral description
    const dueDate = new Date(charge.due_date + "T12:00:00Z")
    const monthYear = dueDate.toLocaleDateString("pt-BR", {
      month: "2-digit",
      year: "numeric",
    })
    const neutralDescription = `Prestacao de servicos profissionais - Ref. ${monthYear}`

    const billingTypeMap: Record<string, string> = {
      pix: "PIX",
      boleto: "BOLETO",
      credit_card: "CREDIT_CARD",
    }

    try {
      const createResp = await fetch(`${asaasBaseUrl}/payments`, {
        method: "POST",
        headers: {
          access_token: asaasApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: charge.asaas_customer_id,
          billingType: billingTypeMap[charge.payment_method || "pix"] || "PIX",
          value: Number(charge.amount),
          dueDate: charge.due_date,
          description: neutralDescription,
        }),
      })

      if (createResp.ok) {
        const paymentData = await createResp.json()

        await supabase
          .from("charges")
          .update({
            asaas_payment_id: paymentData.id,
            status: "pending",
          })
          .eq("id", charge.id)

        await supabase.rpc("log_audit_system", {
          p_actor_id: null,
          p_actor_source: "cron",
          p_patient_id: charge.patient_id,
          p_action: "CREATE_CHARGE",
          p_metadata: JSON.stringify({
            charge_id: charge.id,
            retry: true,
          }),
        })

        retriedCount++
      } else {
        failedCount++
      }
    } catch {
      failedCount++
    }
  }

  // Notify psychologists about persistent failures
  if (psychologistsToNotify.size > 0 && resendApiKey) {
    for (const psychId of psychologistsToNotify) {
      const { data: psychProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", psychId)
        .single()

      if (psychProfile?.email) {
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
              html: `<p>Ola, ${psychProfile.full_name?.split(" ")[0] || ""}.</p><p>Algumas cobrancas nao puderam ser processadas automaticamente. Acesse o painel financeiro para verificar.</p>`,
              text: `Ola, ${psychProfile.full_name?.split(" ")[0] || ""}. Algumas cobrancas nao puderam ser processadas automaticamente. Acesse o painel financeiro para verificar.`,
            }),
          })
        } catch {
          // Email failure is non-critical
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ retried: retriedCount, failed: failedCount }),
    { headers: { "Content-Type": "application/json" } },
  )
})
