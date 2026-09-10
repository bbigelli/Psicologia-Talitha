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

  const { data } = await supabase
    .from("charges")
    .select(
      "id, amount, due_date, payment_method, status, created_at, asaas_payment_id, patient_id, patients(full_name)",
    )
    .order("created_at", { ascending: false })

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

/**
 * Financeiro sub-navigation tabs (inline, not a separate component).
 */
function FinanceiroTabs() {
  return (
    <nav className="flex gap-1 border-b pb-1" aria-label="Financeiro">
      <Link
        href="/financeiro/cobrancas"
        className="rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
      >
        Cobrancas
      </Link>
      <Link
        href="/financeiro/assinaturas"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        Assinaturas
      </Link>
      <Link
        href="/financeiro/inadimplentes"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        Inadimplentes
      </Link>
    </nav>
  )
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
