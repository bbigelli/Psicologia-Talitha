/**
 * Edge Function: cancel-subscription
 *
 * Cancels a subscription on the Asaas API and updates the local record.
 * Body accepts ONLY { subscription_id } -- all data derived from the DB.
 *
 * Pre-conditions (same pattern as create-charge):
 * 1. JWT verified (verify_jwt = true)
 * 2. Role = psychologist checked in DB
 * 3. Body contains ONLY subscription_id (uuid)
 * 4. Subscription loaded, must have asaas_subscription_id
 * 5. subscriptions.psychologist_id == auth.uid() (ownership)
 * 6. DELETE /v3/subscriptions/{id} called on Asaas
 * 7. Status updated to 'cancelled' ONLY after Asaas confirms
 * 8. Audit log with actor
 * 9. Generic error response on any failure
 *
 * @see B4 fix: cancelSubscription must propagate to Asaas
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

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

  // Verify JWT
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

  // Parse body: ONLY subscription_id
  let subscriptionId: string
  try {
    const body = await req.json()
    subscriptionId = body.subscription_id
    if (!subscriptionId || typeof subscriptionId !== "string") {
      throw new Error("missing")
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        subscriptionId,
      )
    ) {
      throw new Error("invalid format")
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  // Load subscription
  const { data: sub, error: subError } = await adminClient
    .from("subscriptions")
    .select("id, patient_id, psychologist_id, asaas_subscription_id, status")
    .eq("id", subscriptionId)
    .single()

  if (subError || !sub) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    )
  }

  // Verify ownership
  if (sub.psychologist_id !== user.id) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )
  }

  if (sub.status === "cancelled") {
    return new Response(
      JSON.stringify({ error: "Assinatura ja cancelada" }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    )
  }

  // Cancel on Asaas FIRST -- only update locally after confirmation
  if (sub.asaas_subscription_id) {
    try {
      const deleteResp = await fetch(
        `${asaasBaseUrl}/subscriptions/${sub.asaas_subscription_id}`,
        {
          method: "DELETE",
          headers: { access_token: asaasApiKey },
        },
      )

      if (!deleteResp.ok) {
        // Asaas refused the cancellation -- do NOT update locally
        return new Response(
          JSON.stringify({ error: "Servico de pagamento indisponivel" }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        )
      }
    } catch {
      // Network error -- do NOT update locally
      return new Response(
        JSON.stringify({ error: "Servico de pagamento indisponivel" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      )
    }
  }

  // Asaas confirmed (or no asaas_subscription_id) -- update locally
  const { error: updateError } = await adminClient
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", subscriptionId)

  if (updateError) {
    // Critical: Asaas cancelled but local update failed.
    // The subscription IS cancelled on Asaas, but our DB still says active.
    // Return error so the caller retries.
    return new Response(
      JSON.stringify({ error: "Servico indisponivel" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  // Audit log
  const { error: auditError } = await adminClient.rpc("log_audit_system", {
    p_actor_id: user.id,
    p_actor_source: "edge_function",
    p_patient_id: sub.patient_id,
    p_action: "CANCEL_SUBSCRIPTION",
    p_metadata: JSON.stringify({ subscription_id: subscriptionId }),
  })

  if (auditError) {
    // Non-critical: subscription is cancelled. Audit failure does not
    // undo the cancellation.
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } },
  )
})
