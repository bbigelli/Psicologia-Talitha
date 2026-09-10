/**
 * Edge Function: manage-asaas-customer
 *
 * Creates or retrieves an Asaas customer for a patient.
 * Called by the Server Action BEFORE create-charge, so that
 * create-charge only needs charge_id (AC1 requirement).
 *
 * Security:
 * - verify_jwt = true (Supabase validates JWT)
 * - Role checked in DB (profiles.role = 'psychologist')
 * - Patient ownership verified (patients.psychologist_id = auth.uid())
 * - CPF received from Server Action (which decrypted it with KEK)
 * - ASAAS_API_KEY stays in Edge Function domain
 *
 * @see architecture.md §8.1
 * @see security-review-architecture.md AC1
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

  // --- Parse and validate body ---
  let body: { patient_id: string; cpf: string; name: string; email: string; phone?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  if (!body.patient_id || !body.cpf || !body.name || !body.email) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  // Validate patient belongs to this psychologist
  const { data: patient } = await adminClient
    .from("patients")
    .select("id, psychologist_id")
    .eq("id", body.patient_id)
    .single()

  if (!patient || patient.psychologist_id !== user.id) {
    return new Response(
      JSON.stringify({ error: "Operacao nao permitida" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )
  }

  // --- Check if customer already exists on Asaas ---
  // Search by CPF first (prevents duplicate customers)
  try {
    const searchResp = await fetch(
      `${asaasBaseUrl}/customers?cpfCnpj=${body.cpf}`,
      {
        headers: { access_token: asaasApiKey },
      },
    )

    if (searchResp.ok) {
      const searchData = await searchResp.json()
      if (searchData.data && searchData.data.length > 0) {
        const existingCustomer = searchData.data[0]
        return new Response(
          JSON.stringify({ customer_id: existingCustomer.id }),
          { headers: { "Content-Type": "application/json" } },
        )
      }
    }
  } catch {
    // Search failed — proceed to create
  }

  // --- Create customer on Asaas ---
  try {
    const createResp = await fetch(`${asaasBaseUrl}/customers`, {
      method: "POST",
      headers: {
        access_token: asaasApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: body.name,
        cpfCnpj: body.cpf,
        email: body.email,
        mobilePhone: body.phone || undefined,
      }),
    })

    if (!createResp.ok) {
      return new Response(
        JSON.stringify({ error: "Servico de pagamento indisponivel" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      )
    }

    const customerData = await createResp.json()
    return new Response(
      JSON.stringify({ customer_id: customerData.id }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch {
    return new Response(
      JSON.stringify({ error: "Servico de pagamento indisponivel" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )
  }
})
