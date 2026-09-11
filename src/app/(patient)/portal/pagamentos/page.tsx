import { Suspense } from "react"

import { createClient } from "@/lib/supabase/server"
import {
  PatientPaymentHistory,
  PatientPaymentHistorySkeleton,
  type PatientCharge,
} from "@/components/financial/PatientPaymentHistory"
import type { ChargeStatus } from "@/schemas/charge"

/**
 * Patient payment history page.
 *
 * Shows charges for the authenticated patient, ordered by date (recent first).
 * RLS enforces that only the patient's own charges are returned.
 *
 * @see wireframe B.08
 * @see US-107
 */

/**
 * Derive the Asaas invoice base URL from the API base URL.
 * W3 fix: no hardcoded sandbox URL.
 *
 * ASAAS_BASE_URL is a server-side env var (supabase secrets replicated
 * to EasyPanel). If not available, we omit payment links entirely
 * (safer than a wrong URL).
 */
function getAsaasInvoiceBase(): string | null {
  const baseUrl = process.env.ASAAS_BASE_URL
  if (!baseUrl) return null
  if (baseUrl.includes("sandbox")) return "https://sandbox.asaas.com/i"
  return "https://www.asaas.com/i"
}

async function getPatientCharges(): Promise<PatientCharge[]> {
  const supabase = await createClient()
  const invoiceBase = getAsaasInvoiceBase()

  // RLS ensures patient sees only their own charges
  const { data } = await supabase
    .from("charges")
    .select(
      "id, amount, due_date, paid_at, status, subscription_id, asaas_payment_id",
    )
    .order("due_date", { ascending: false })

  if (!data) return []

  return data.map((charge) => ({
    id: charge.id,
    amount: Number(charge.amount),
    due_date: charge.due_date,
    paid_at: charge.paid_at,
    status: charge.status as ChargeStatus,
    subscription_id: charge.subscription_id,
    asaas_payment_id: charge.asaas_payment_id,
    invoice_url:
      invoiceBase && charge.asaas_payment_id
        ? `${invoiceBase}/${charge.asaas_payment_id}`
        : null,
  }))
}

async function PaymentHistoryServer() {
  const charges = await getPatientCharges()
  return <PatientPaymentHistory charges={charges} />
}

export default function PagamentosPage() {
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold text-foreground">Pagamentos</h1>

      <Suspense fallback={<PatientPaymentHistorySkeleton />}>
        <PaymentHistoryServer />
      </Suspense>
    </div>
  )
}
