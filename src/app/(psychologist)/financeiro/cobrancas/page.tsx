import Link from "next/link"
import { Suspense } from "react"
import { Plus } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import {
  ChargeTable,
  ChargeTableSkeleton,
  type ChargeListItem,
} from "@/components/financial/ChargeTable"
import { FinanceiroTabs } from "@/components/financial/FinanceiroTabs"
import type { ChargeStatus, PaymentMethod } from "@/schemas/charge"

/**
 * Fetch all charges for the current psychologist.
 *
 * Uses explicit column list — never select('*') on tables with sensitive data.
 * RLS ensures only charges belonging to this psychologist are returned.
 * Joins patient name for display.
 */
async function getCharges(): Promise<ChargeListItem[]> {
  const supabase = await createClient()

  // W5 FIX: limit to most recent 200 charges to avoid unbounded queries.
  // For a solo practice (~1500/year), this covers recent history well.
  const { data } = await supabase
    .from("charges")
    .select(
      "id, amount, due_date, payment_method, status, created_at, asaas_payment_id, patient_id, patients(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (!data) return []

  return data.map((charge) => ({
    id: charge.id,
    patient_name:
      (charge.patients as unknown as { full_name: string })?.full_name ?? "—",
    amount: Number(charge.amount),
    due_date: charge.due_date,
    payment_method: charge.payment_method as PaymentMethod | null,
    status: charge.status as ChargeStatus,
    created_at: charge.created_at,
    asaas_payment_id: charge.asaas_payment_id,
  }))
}

async function ChargeTableServer() {
  const charges = await getCharges()
  return <ChargeTable charges={charges} />
}

export default function CobrancasPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <Button render={<Link href="/financeiro/cobrancas/nova" />}>
          <Plus className="mr-2 h-4 w-4" />
          Nova cobranca
        </Button>
      </div>

      <FinanceiroTabs />

      <Suspense fallback={<ChargeTableSkeleton />}>
        <ChargeTableServer />
      </Suspense>
    </div>
  )
}
