/**
 * Edge Function: create-subscription
 *
 * Creates a recurring subscription on Asaas for an existing subscription record.
 * Body accepts ONLY { subscription_id } — all data derived from the DB.
 *
 * Pre-conditions (same pattern as create-charge, AC1):
 * 1. JWT verified (verify_jwt = true)
 * 2. Role = psychologist checked in DB (never from JWT claims)
 * 3. Body contains ONLY subscription_id (uuid)
 * 4. Subscription loaded with status = 'active' and asaas_subscription_id IS NULL
 * 5. subscriptions.psychologist_id == auth.uid() (ownership)
 * 6. Patient, value, billing day derived from DB record (never from body)
 * 7. Asaas customer resolved (from charges or Asaas API search)
 * 8. Subscription created on Asaas, asaas_subscription_id updated
 * 9. Audit log with actor
 * 10. Generic error response on any failure
 *
 * @see architecture.md §8.1
 * @see US-103
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // --- Auth: extract JWT and verify user ---
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )
  }

  const jwt = authHeader.replace("Bearer ", "")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const asaasApiKey = Deno.env.get("ASAAS_API_KEY")
  const asaasBaseUrl = Deno.env.get("ASAAS_BASE_URL")

  if (!asaasApiKey || !asaasBaseUrl) {
    return new Response(
      JSON.stringify({ error: "Servico indisponivel" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  // Verify JWT and get user
  const userClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY") ?? serviceRoleKey,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )
  }

  // Check role in DB (never from JWT claims)
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "psychologist") {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )
  }

  // --- Parse body: ONLY subscription_id ---
  let subscriptionId: string
  try {
    const body = await req.json()
    subscriptionId = body.subscription_id
    if (!subscriptionId || typeof subscriptionId !== "string") {
      throw new Error("missing subscription_id")
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        subscriptionId,
      )
    ) {
      throw new Error("invalid subscription_id format")
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  // --- Load subscription from DB ---
  const { data: sub, error: subError } = await adminClient
    .from("subscriptions")
    .select(
      "id, patient_id, psychologist_id, monthly_value, billing_day, sessions_per_cycle, status, asaas_subscription_id",
    )
    .eq("id", subscriptionId)
    .single()

  if (subError || !sub) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    )
  }

  // Must be active and not yet linked to Asaas
  if (sub.status !== "active" || sub.asaas_subscription_id) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    )
  }

  // Verify ownership
  if (sub.psychologist_id !== user.id) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )
  }

  // --- Resolve Asaas customer ---
  // Strategy: look up from previous charges, then search Asaas by patient email
  let asaasCustomerId: string | null = null

  // 1. Check existing charges for this patient
  const { data: prevCharge } = await adminClient
    .from("charges")
    .select("asaas_customer_id")
    .eq("patient_id", sub.patient_id)
    .not("asaas_customer_id", "is", null)
    .limit(1)
    .maybeSingle()

  if (prevCharge?.asaas_customer_id) {
    asaasCustomerId = prevCharge.asaas_customer_id
  }

  // 2. If not found, search Asaas by patient email
  if (!asaasCustomerId) {
    const { data: patient } = await adminClient
      .from("patients")
      .select("email")
      .eq("id", sub.patient_id)
      .single()

    if (patient?.email) {
      try {
        const searchResp = await fetch(
          `${asaasBaseUrl}/customers?email=${encodeURIComponent(patient.email)}`,
          { headers: { access_token: asaasApiKey } },
        )
        if (searchResp.ok) {
          const searchData = await searchResp.json()
          if (searchData.data && searchData.data.length > 0) {
            asaasCustomerId = searchData.data[0].id
          }
        }
      } catch {
        // Search failed — proceed to error
      }
    }
  }

  if (!asaasCustomerId) {
    // Customer must be created first via manage-asaas-customer
    // The Server Action should have called it before invoking this function
    return new Response(
      JSON.stringify({ error: "Servico indisponivel" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  // --- Build neutral description ---
  const neutralDescription = "Prestacao de servicos profissionais - Pacote mensal"

  // --- Calculate next due date ---
  const today = new Date()
  let nextDueYear = today.getFullYear()
  let nextDueMonth = today.getMonth() // 0-based
  const currentDay = today.getDate()

  // If billing_day has already passed this month, start next month
  if (currentDay >= sub.billing_day) {
    nextDueMonth += 1
    if (nextDueMonth > 11) {
      nextDueMonth = 0
      nextDueYear += 1
    }
  }

  const nextDueDate = `${nextDueYear}-${String(nextDueMonth + 1).padStart(2, "0")}-${String(sub.billing_day).padStart(2, "0")}`

  // --- Create subscription on Asaas ---
  try {
    const subscriptionBody = {
      customer: asaasCustomerId,
      billingType: "PIX",
      value: Number(sub.monthly_value),
      nextDueDate,
      cycle: "MONTHLY",
      description: neutralDescription,
    }

    const createResp = await fetch(`${asaasBaseUrl}/subscriptions`, {
      method: "POST",
      headers: {
        access_token: asaasApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscriptionBody),
    })

    if (!createResp.ok) {
      return new Response(
        JSON.stringify({ error: "Servico de pagamento indisponivel" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      )
    }

    const asaasSub = await createResp.json()

    // --- Update subscription with Asaas data ---
    const { error: updateError } = await adminClient
      .from("subscriptions")
      .update({ asaas_subscription_id: asaasSub.id })
      .eq("id", subscriptionId)

    if (updateError) {
      // Subscription created on Asaas but DB update failed.
      // We cannot leave the local record without the Asaas link —
      // report it and return error so the caller knows.
      return new Response(
        JSON.stringify({ error: "Servico indisponivel" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      )
    }

    // --- Audit log ---
    const { error: auditError } = await adminClient.rpc("log_audit_system", {
      p_actor_id: user.id,
      p_actor_source: "edge_function",
      p_patient_id: sub.patient_id,
      p_action: "CREATE_SUBSCRIPTION",
      p_metadata: JSON.stringify({
        subscription_id: subscriptionId,
        monthly_value: Number(sub.monthly_value),
        billing_day: sub.billing_day,
        sessions_per_cycle: sub.sessions_per_cycle,
      }),
    })

    if (auditError) {
      // Non-critical: subscription exists, audit failed.
      // Do NOT fail the operation — the subscription is already live.
    }

    return new Response(
      JSON.stringify({
        success: true,
        asaas_subscription_id: asaasSub.id,
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch {
    return new Response(
      JSON.stringify({ error: "Servico de pagamento indisponivel" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )
  }
})
