/**
 * Edge Function: asaas-webhook
 *
 * Receives and processes Asaas payment webhooks.
 *
 * Four mandatory rules (security-review-architecture.md):
 * 1. Validate authToken with timingSafeEqual BEFORE any parsing
 * 2. Payload is NOT authoritative -- re-consult GET /v3/payments/{id}
 * 3. Idempotency via asaas_event_id PK (deterministic key, no Date.now)
 * 4. No raw payload persisted -- allowlist columns only, no CPF/name
 *
 * Subscription charges:
 * When a payment belongs to an Asaas subscription but no local charge
 * exists, the webhook creates a charge record linked to the local
 * subscription. The subscription field comes from the SAME re-consult
 * (Rule 2) -- no second API call.
 *
 * @see architecture.md section 8.1
 * @see ADR-0003
 * @see CLAUDE.md (payload nao e autoritativo)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// --- Security ---

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

/** Events we process -- mapped to our charge statuses */
const EVENT_STATUS_MAP: Record<string, string> = {
  PAYMENT_RECEIVED: "paid",
  PAYMENT_CONFIRMED: "paid",
  PAYMENT_OVERDUE: "overdue",
  PAYMENT_REFUNDED: "refunded",
  PAYMENT_CHARGEBACK_REQUESTED: "chargeback",
  PAYMENT_CHARGEBACK_DISPUTE: "chargeback",
}

const HANDLED_EVENTS = new Set(Object.keys(EVENT_STATUS_MAP))

/** Map Asaas authoritative status to our status */
const ASAAS_STATUS_MAP: Record<string, string> = {
  RECEIVED: "paid",
  CONFIRMED: "paid",
  OVERDUE: "overdue",
  REFUNDED: "refunded",
  REFUND_REQUESTED: "refunded",
  CHARGEBACK_REQUESTED: "chargeback",
  CHARGEBACK_DISPUTE: "chargeback",
}

/** Map Asaas billing type to our payment_method */
const BILLING_TYPE_MAP: Record<string, string> = {
  PIX: "pix",
  BOLETO: "boleto",
  CREDIT_CARD: "credit_card",
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // --- RULE 1: Validate authToken BEFORE parsing ---
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN")
  if (!webhookToken) {
    return new Response("Server misconfigured", { status: 500 })
  }

  const providedToken = req.headers.get("asaas-access-token") ?? ""
  if (!timingSafeEqual(providedToken, webhookToken)) {
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
      // Audit failure must not change the response
    }
    return new Response("Unauthorized", { status: 401 })
  }

  // --- Parse body (only AFTER auth validation) ---
  let payload: {
    id?: string
    event?: string
    payment?: { id?: string }
  }
  try {
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

  // --- B2 FIX: Distinguish unhandled events from malformed handled events ---
  // No event type at all -- nothing to do
  if (!eventType) {
    return new Response(
      JSON.stringify({ received: true }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // Event type we do not handle -- 200 is correct (we don't want retries)
  if (!HANDLED_EVENTS.has(eventType)) {
    return new Response(
      JSON.stringify({ received: true, skipped: true }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // Handled event but missing payment.id -- malformed payload we SHOULD
  // have been able to process. Return 422 so Asaas retries.
  if (!paymentIdFromPayload) {
    return new Response(
      JSON.stringify({ error: "Missing payment.id for handled event" }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    )
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const asaasApiKey = Deno.env.get("ASAAS_API_KEY")!
  const asaasBaseUrl = Deno.env.get("ASAAS_BASE_URL")!
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // --- B1 FIX: Deterministic idempotency key ---
  // Use the webhook event ID from the payload if available.
  // If Asaas does not send one, derive from payment_id + event_type.
  // NEVER use Date.now() -- it makes every delivery unique.
  const asaasEventId = payload.id
    ? String(payload.id)
    : `${paymentIdFromPayload}_${eventType}`

  // --- RULE 3: Idempotency via PK ---
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
    if (insertError.code === "23505") {
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { headers: { "Content-Type": "application/json" } },
      )
    }
    return new Response("Internal error", { status: 500 })
  }

  if (!insertedEvent) {
    return new Response(
      JSON.stringify({ received: true, duplicate: true }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // --- RULE 2: Re-consult Asaas API (payload NOT authoritative) ---
  // W9 FIX: Store the full response so we can read subscription/customer
  // fields without a second API call.
  let verifiedPayment: Record<string, unknown> | null = null

  try {
    const verifyResp = await fetch(
      `${asaasBaseUrl}/payments/${paymentIdFromPayload}`,
      { headers: { access_token: asaasApiKey } },
    )

    if (!verifyResp.ok) {
      await adminClient
        .from("payment_webhook_events")
        .update({ result: "verification_failed" })
        .eq("asaas_event_id", asaasEventId)
      return new Response("Verification failed", { status: 500 })
    }

    verifiedPayment = await verifyResp.json()
  } catch {
    await adminClient
      .from("payment_webhook_events")
      .update({ result: "verification_error" })
      .eq("asaas_event_id", asaasEventId)
    return new Response("Verification error", { status: 500 })
  }

  const authoritativeStatus = String(verifiedPayment.status ?? "")
  const authoritativeValue =
    typeof verifiedPayment.value === "number" ? verifiedPayment.value : null
  const authoritativeDueDate =
    typeof verifiedPayment.dueDate === "string"
      ? verifiedPayment.dueDate
      : null

  const newStatus = ASAAS_STATUS_MAP[authoritativeStatus]
  if (!newStatus) {
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

  // --- Find or create the local charge ---
  let charge: { id: string; patient_id: string; status: string } | null = null

  const { data: existingCharge } = await adminClient
    .from("charges")
    .select("id, patient_id, status")
    .eq("asaas_payment_id", paymentIdFromPayload)
    .maybeSingle()

  if (existingCharge) {
    charge = existingCharge
  } else {
    // W9 FIX: Use fields from the SAME re-consult response (no second call)
    const asaasSubscriptionId =
      typeof verifiedPayment.subscription === "string"
        ? verifiedPayment.subscription
        : null
    const asaasCustomerId =
      typeof verifiedPayment.customer === "string"
        ? verifiedPayment.customer
        : null
    const paymentMethod =
      typeof verifiedPayment.billingType === "string"
        ? BILLING_TYPE_MAP[verifiedPayment.billingType] ?? null
        : null

    if (asaasSubscriptionId) {
      const { data: localSub } = await adminClient
        .from("subscriptions")
        .select("id, patient_id, psychologist_id")
        .eq("asaas_subscription_id", asaasSubscriptionId)
        .maybeSingle()

      if (localSub) {
        // W8 FIX: Use canonical description format with Ref. MM/AAAA
        const refDate = authoritativeDueDate
          ? new Date(authoritativeDueDate + "T12:00:00Z")
          : new Date()
        const monthYear = refDate.toLocaleDateString("pt-BR", {
          month: "2-digit",
          year: "numeric",
        })

        const { data: newCharge, error: createError } = await adminClient
          .from("charges")
          .insert({
            patient_id: localSub.patient_id,
            psychologist_id: localSub.psychologist_id,
            subscription_id: localSub.id,
            asaas_payment_id: paymentIdFromPayload,
            asaas_customer_id: asaasCustomerId,
            amount: authoritativeValue ?? 0,
            due_date:
              authoritativeDueDate ??
              new Date().toISOString().split("T")[0],
            payment_method: paymentMethod,
            description: `Prestacao de servicos profissionais - Ref. ${monthYear}`,
            status: "pending",
          })
          .select("id, patient_id, status")
          .single()

        // B3 FIX: Distinguish duplicate key from other INSERT errors
        if (createError || !newCharge) {
          const isDuplicate = createError?.code === "23505"

          await adminClient
            .from("payment_webhook_events")
            .update({
              status: authoritativeStatus,
              value: authoritativeValue,
              due_date: authoritativeDueDate,
              processed_at: new Date().toISOString(),
              result: isDuplicate
                ? "subscription_charge_duplicate"
                : "subscription_charge_create_failed",
            })
            .eq("asaas_event_id", asaasEventId)

          if (isDuplicate) {
            // Charge already exists (by asaas_payment_id UNIQUE) -- 200
            // Re-fetch it so we can still update its status below
            const { data: dupCharge } = await adminClient
              .from("charges")
              .select("id, patient_id, status")
              .eq("asaas_payment_id", paymentIdFromPayload)
              .maybeSingle()

            if (dupCharge) {
              charge = dupCharge
            } else {
              return new Response(
                JSON.stringify({ received: true, duplicate: true }),
                { headers: { "Content-Type": "application/json" } },
              )
            }
          } else {
            // Genuine DB error -- return 500 so Asaas retries
            return new Response("Internal error", { status: 500 })
          }
        } else {
          charge = newCharge
        }
      }
    }

    if (!charge) {
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
