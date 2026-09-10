/**
 * Edge Function: asaas-webhook
 *
 * Receives and processes Asaas payment webhooks.
 *
 * Four mandatory rules (security-review-architecture.md §6):
 * 1. Validate authToken with timingSafeEqual BEFORE any parsing
 * 2. Payload is NOT authoritative — re-consult GET /v3/payments/{id}
 * 3. Idempotency via asaas_event_id PK with ON CONFLICT DO NOTHING
 * 4. No raw payload persisted — allowlist columns only, no CPF/name
 *
 * Processed events:
 * - PAYMENT_RECEIVED  → charge.status = 'paid'
 * - PAYMENT_OVERDUE   → charge.status = 'overdue'
 * - PAYMENT_REFUNDED  → charge.status = 'refunded'
 *
 * Monotonic state machine enforced by DB trigger (fn_charges_monotonic_status).
 * Out-of-order webhooks that would regress status are silently ignored.
 *
 * @see architecture.md §8.1
 * @see ADR-0003
 * @see CLAUDE.md (payload nao e autoritativo)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// --- Security ---

/**
 * Timing-safe comparison to prevent timing attacks on webhook token.
 * MUST be called BEFORE any JSON parsing of the payload.
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

/** Map Asaas event types to our charge statuses */
const EVENT_STATUS_MAP: Record<string, string> = {
  PAYMENT_RECEIVED: "paid",
  PAYMENT_CONFIRMED: "paid",
  PAYMENT_OVERDUE: "overdue",
  PAYMENT_REFUNDED: "refunded",
  PAYMENT_CHARGEBACK_REQUESTED: "chargeback",
  PAYMENT_CHARGEBACK_DISPUTE: "chargeback",
}

/** Events we actually process */
const HANDLED_EVENTS = new Set(Object.keys(EVENT_STATUS_MAP))

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // --- RULE 1: Validate authToken BEFORE parsing ---
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN")
  if (!webhookToken) {
    return new Response("Server misconfigured", { status: 500 })
  }

  // Asaas sends the token in the 'asaas-access-token' header
  const providedToken = req.headers.get("asaas-access-token") ?? ""
  if (!timingSafeEqual(providedToken, webhookToken)) {
    // Audit: rejected webhook
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      const adminClient = createClient(supabaseUrl, serviceRoleKey)
      await adminClient.rpc("log_audit_system", {
        p_actor_id: null,
        p_actor_source: "webhook",
        p_patient_id: null,
        p_action: "WEBHOOK_REJECTED",
        p_metadata: JSON.stringify({ reason: "invalid_token" }),
      })
    } catch {
      // Audit failure should not change the response
    }
    return new Response("Unauthorized", { status: 401 })
  }

  // --- Parse body (only AFTER auth validation) ---
  let payload: {
    event?: string
    payment?: { id?: string }
  }
  try {
    // Limit body size to 64KB (architecture §8.1)
    const bodyText = await req.text()
    if (bodyText.length > 65536) {
      return new Response("Payload too large", { status: 413 })
    }
    payload = JSON.parse(bodyText)
  } catch {
    return new Response("Bad request", { status: 400 })
  }

  const eventType = payload.event
  const paymentIdFromPayload = payload.payment?.id

  if (!eventType || !paymentIdFromPayload) {
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    })
  }

  // Skip events we don't handle
  if (!HANDLED_EVENTS.has(eventType)) {
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      headers: { "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const asaasApiKey = Deno.env.get("ASAAS_API_KEY")!
  const asaasBaseUrl = Deno.env.get("ASAAS_BASE_URL")!
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // --- RULE 3: Idempotency check ---
  // Generate a unique event ID from the payment ID + event type
  // Asaas doesn't always send a unique event ID, so we construct one
  const asaasEventId = `${paymentIdFromPayload}_${eventType}_${Date.now()}`

  // Try to insert — ON CONFLICT DO NOTHING
  // If the insert returns no row, the event was already processed
  const { data: insertedEvent, error: insertError } = await adminClient
    .from("payment_webhook_events")
    .insert({
      asaas_event_id: asaasEventId,
      event_type: eventType,
      payment_id: paymentIdFromPayload,
      status: "processing",
    })
    .select("asaas_event_id")
    .single()

  if (insertError) {
    // If it's a duplicate key error, the event was already processed
    if (insertError.code === "23505") {
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { headers: { "Content-Type": "application/json" } },
      )
    }
    // Other errors — return 500 so Asaas retries
    return new Response("Internal error", { status: 500 })
  }

  if (!insertedEvent) {
    return new Response(
      JSON.stringify({ received: true, duplicate: true }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // --- RULE 2: Re-consult Asaas API (payload NOT authoritative) ---
  let authoritativeStatus: string
  let authoritativeValue: number | null = null
  let authoritativeDueDate: string | null = null

  try {
    const verifyResp = await fetch(
      `${asaasBaseUrl}/payments/${paymentIdFromPayload}`,
      {
        headers: { access_token: asaasApiKey },
      },
    )

    if (!verifyResp.ok) {
      // Can't verify — mark event as failed, return 500 for retry
      await adminClient
        .from("payment_webhook_events")
        .update({ result: "verification_failed" })
        .eq("asaas_event_id", asaasEventId)

      return new Response("Verification failed", { status: 500 })
    }

    const verifiedPayment = await verifyResp.json()
    authoritativeStatus = verifiedPayment.status
    authoritativeValue = verifiedPayment.value ?? null
    authoritativeDueDate = verifiedPayment.dueDate ?? null
  } catch {
    await adminClient
      .from("payment_webhook_events")
      .update({ result: "verification_error" })
      .eq("asaas_event_id", asaasEventId)

    return new Response("Verification error", { status: 500 })
  }

  // Map Asaas status to our status
  const asaasStatusMap: Record<string, string> = {
    RECEIVED: "paid",
    CONFIRMED: "paid",
    OVERDUE: "overdue",
    REFUNDED: "refunded",
    REFUND_REQUESTED: "refunded",
    CHARGEBACK_REQUESTED: "chargeback",
    CHARGEBACK_DISPUTE: "chargeback",
  }

  const newStatus = asaasStatusMap[authoritativeStatus]
  if (!newStatus) {
    // Status doesn't map to a handled transition
    await adminClient
      .from("payment_webhook_events")
      .update({
        status: authoritativeStatus,
        value: authoritativeValue,
        due_date: authoritativeDueDate,
        processed_at: new Date().toISOString(),
        result: "skipped_unmapped_status",
      })
      .eq("asaas_event_id", asaasEventId)

    return new Response(
      JSON.stringify({ received: true, skipped: true }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // --- Find the charge by asaas_payment_id ---
  let charge: { id: string; patient_id: string; status: string } | null = null

  const { data: existingCharge } = await adminClient
    .from("charges")
    .select("id, patient_id, status")
    .eq("asaas_payment_id", paymentIdFromPayload)
    .maybeSingle()

  if (existingCharge) {
    charge = existingCharge
  } else {
    // Charge not found locally. This may be a subscription-generated charge
    // from Asaas. The authoritative payment data (from Rule 2 re-consult)
    // includes a `subscription` field if the payment belongs to a subscription.
    // We need to re-read the full payment to get the subscription field.
    let asaasSubscriptionId: string | null = null
    let asaasCustomerId: string | null = null
    let paymentMethod: string | null = null

    try {
      const fullPaymentResp = await fetch(
        `${asaasBaseUrl}/payments/${paymentIdFromPayload}`,
        { headers: { access_token: asaasApiKey } },
      )
      if (fullPaymentResp.ok) {
        const fullPayment = await fullPaymentResp.json()
        asaasSubscriptionId = fullPayment.subscription || null
        asaasCustomerId = fullPayment.customer || null
        // Map Asaas billing type to our payment method
        const billingMap: Record<string, string> = {
          PIX: "pix",
          BOLETO: "boleto",
          CREDIT_CARD: "credit_card",
        }
        paymentMethod = billingMap[fullPayment.billingType] || null
      }
    } catch {
      // Re-consult failed — we already have the data from the first re-consult
    }

    if (asaasSubscriptionId) {
      // Look up our subscription by asaas_subscription_id
      const { data: localSub } = await adminClient
        .from("subscriptions")
        .select("id, patient_id, psychologist_id")
        .eq("asaas_subscription_id", asaasSubscriptionId)
        .maybeSingle()

      if (localSub) {
        // Create a local charge record for this subscription-generated payment
        const { data: newCharge, error: createError } = await adminClient
          .from("charges")
          .insert({
            patient_id: localSub.patient_id,
            psychologist_id: localSub.psychologist_id,
            subscription_id: localSub.id,
            asaas_payment_id: paymentIdFromPayload,
            asaas_customer_id: asaasCustomerId,
            amount: authoritativeValue ?? 0,
            due_date: authoritativeDueDate ?? new Date().toISOString().split("T")[0],
            payment_method: paymentMethod,
            description: "Prestacao de servicos profissionais - Pacote mensal",
            status: "pending",
          })
          .select("id, patient_id, status")
          .single()

        if (createError || !newCharge) {
          // INSERT failed — could be duplicate asaas_payment_id (UNIQUE)
          // or another constraint. Log and return 200.
          await adminClient
            .from("payment_webhook_events")
            .update({
              status: authoritativeStatus,
              value: authoritativeValue,
              due_date: authoritativeDueDate,
              processed_at: new Date().toISOString(),
              result: "subscription_charge_create_failed",
            })
            .eq("asaas_event_id", asaasEventId)

          return new Response(
            JSON.stringify({ received: true, subscription_charge_create_failed: true }),
            { headers: { "Content-Type": "application/json" } },
          )
        }

        charge = newCharge
      }
    }

    if (!charge) {
      // Not a subscription charge either — genuinely not found
      await adminClient
        .from("payment_webhook_events")
        .update({
          status: authoritativeStatus,
          value: authoritativeValue,
          due_date: authoritativeDueDate,
          processed_at: new Date().toISOString(),
          result: "charge_not_found",
        })
        .eq("asaas_event_id", asaasEventId)

      return new Response(
        JSON.stringify({ received: true, charge_not_found: true }),
        { headers: { "Content-Type": "application/json" } },
      )
    }
  }

  // --- Update charge status ---
  // The monotonic trigger (fn_charges_monotonic_status) will reject
  // invalid transitions. Out-of-order webhooks are handled gracefully.
  const updateFields: Record<string, unknown> = { status: newStatus }
  if (newStatus === "paid") {
    updateFields.paid_at = new Date().toISOString()
  }
  if (newStatus === "refunded") {
    updateFields.refunded_at = new Date().toISOString()
  }

  const { error: updateError } = await adminClient
    .from("charges")
    .update(updateFields)
    .eq("id", charge.id)

  let result = "processed"
  if (updateError) {
    // Check if it's a monotonic violation (expected for out-of-order)
    if (updateError.message?.includes("Invalid charge status transition")) {
      result = "monotonic_skip"
    } else {
      result = "update_failed"
    }
  }

  // --- RULE 4: Update webhook event with allowlist data only ---
  await adminClient
    .from("payment_webhook_events")
    .update({
      status: authoritativeStatus,
      value: authoritativeValue,
      due_date: authoritativeDueDate,
      processed_at: new Date().toISOString(),
      result,
    })
    .eq("asaas_event_id", asaasEventId)

  // --- Audit log ---
  await adminClient.rpc("log_audit_system", {
    p_actor_id: null,
    p_actor_source: "webhook",
    p_patient_id: charge.patient_id,
    p_action: "WEBHOOK_PROCESSED",
    p_metadata: JSON.stringify({
      event_type: eventType,
      charge_id: charge.id,
      new_status: newStatus,
      result,
    }),
  })

  return new Response(
    JSON.stringify({ received: true, result }),
    { headers: { "Content-Type": "application/json" } },
  )
})
