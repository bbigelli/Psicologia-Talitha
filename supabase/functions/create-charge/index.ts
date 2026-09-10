/**
 * Edge Function: create-charge
 *
 * Creates a payment on Asaas for an existing charge record.
 * Body accepts ONLY { charge_id } — all data derived from the DB.
 *
 * Pre-conditions (architecture.md §8.1, security-review AC1):
 * 1. JWT verified (verify_jwt = true)
 * 2. Role = psychologist checked in DB (never from JWT claims)
 * 3. Body contains ONLY charge_id (uuid)
 * 4. Charge loaded with status = 'pending_creation'
 * 5. charges.psychologist_id == auth.uid()
 * 6. Patient, value, due date derived from DB record
 * 7. Customer created on Asaas if necessary
 * 8. Charge created on Asaas, status updated
 * 9. Audit log with actor
 * 10. Generic error response on any failure
 *
 * @see architecture.md §8.1
 * @see security-review-architecture.md AC1
 * @see ADR-0003
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
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceRoleKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )
  }

  // Check role in DB
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

  // --- Parse body: ONLY charge_id ---
  let chargeId: string
  try {
    const body = await req.json()
    chargeId = body.charge_id
    if (!chargeId || typeof chargeId !== "string") {
      throw new Error("missing charge_id")
    }
    // Basic UUID format validation
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chargeId)) {
      throw new Error("invalid charge_id format")
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  // --- Load charge from DB ---
  const { data: charge, error: chargeError } = await adminClient
    .from("charges")
    .select("id, patient_id, psychologist_id, amount, due_date, payment_method, description, status, asaas_customer_id")
    .eq("id", chargeId)
    .eq("status", "pending_creation")
    .single()

  if (chargeError || !charge) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    )
  }

  // Verify ownership: psychologist_id must match auth user
  if (charge.psychologist_id !== user.id) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )
  }

  // --- Verify Asaas customer exists ---
  if (!charge.asaas_customer_id) {
    // Try to find from previous charges for this patient
    const { data: prevCharge } = await adminClient
      .from("charges")
      .select("asaas_customer_id")
      .eq("patient_id", charge.patient_id)
      .not("asaas_customer_id", "is", null)
      .limit(1)
      .single()

    if (prevCharge?.asaas_customer_id) {
      // Update current charge with customer ID
      await adminClient
        .from("charges")
        .update({ asaas_customer_id: prevCharge.asaas_customer_id })
        .eq("id", chargeId)

      charge.asaas_customer_id = prevCharge.asaas_customer_id
    } else {
      // No customer found — charge cannot proceed
      // The Server Action should have called manage-asaas-customer first
      return new Response(
        JSON.stringify({ error: "Servico indisponivel" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      )
    }
  }

  // --- Build neutral description ---
  const dueDate = new Date(charge.due_date + "T12:00:00Z")
  const monthYear = dueDate.toLocaleDateString("pt-BR", {
    month: "2-digit",
    year: "numeric",
  })
  const neutralDescription = `Prestacao de servicos profissionais - Ref. ${monthYear}`

  // --- Create payment on Asaas ---
  try {
    // Map payment method to Asaas billing type
    const billingTypeMap: Record<string, string> = {
      pix: "PIX",
      boleto: "BOLETO",
      credit_card: "CREDIT_CARD",
    }

    const billingType = billingTypeMap[charge.payment_method || "pix"] || "PIX"

    const paymentBody: Record<string, unknown> = {
      customer: charge.asaas_customer_id,
      billingType,
      value: Number(charge.amount),
      dueDate: charge.due_date,
      description: neutralDescription,
    }

    const createResp = await fetch(`${asaasBaseUrl}/payments`, {
      method: "POST",
      headers: {
        access_token: asaasApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentBody),
    })

    if (!createResp.ok) {
      // Asaas error — charge stays pending_creation for retry
      return new Response(
        JSON.stringify({ error: "Servico de pagamento indisponivel" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      )
    }

    const paymentData = await createResp.json()

    // --- Update charge with Asaas data ---
    const { error: updateError } = await adminClient
      .from("charges")
      .update({
        asaas_payment_id: paymentData.id,
        status: "pending",
      })
      .eq("id", chargeId)

    if (updateError) {
      // Payment created on Asaas but DB update failed
      // The charge stays in pending_creation, retry will fix it
      return new Response(
        JSON.stringify({ error: "Servico indisponivel" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      )
    }

    // --- Audit log ---
    await adminClient.rpc("log_audit_system", {
      p_actor_id: user.id,
      p_actor_source: "edge_function",
      p_patient_id: charge.patient_id,
      p_action: "CREATE_CHARGE",
      p_metadata: JSON.stringify({
        charge_id: chargeId,
        amount: Number(charge.amount),
        payment_method: charge.payment_method,
      }),
    })

    return new Response(
      JSON.stringify({
        success: true,
        asaas_payment_id: paymentData.id,
        invoice_url: paymentData.invoiceUrl || null,
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
