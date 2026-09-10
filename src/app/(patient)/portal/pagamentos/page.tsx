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

async function getPatientCharges(): Promise<PatientCharge[]> {
  const supabase = await createClient()

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
