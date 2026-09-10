import Link from "next/link"
import { Suspense } from "react"

import { createClient } from "@/lib/supabase/server"
import {
  DefaultersList,
  DefaultersListSkeleton,
  type DefaulterItem,
} from "@/components/financial/DefaultersList"

/**
 * Defaulters page — patients with overdue charges.
 *
 * Aggregates charges by patient: total overdue amount, count, oldest date.
 * Only charges with status 'overdue' are considered.
 *
 * @see wireframe A.14
 * @see US-106
 */

async function getDefaulters(): Promise<DefaulterItem[]> {
  const supabase = await createClient()

  // Fetch all overdue charges with patient info
  const { data: charges } = await supabase
    .from("charges")
    .select("id, patient_id, amount, due_date, patients(full_name)")
    .eq("status", "overdue")
    .order("due_date", { ascending: true })

  if (!charges || charges.length === 0) return []

  // Aggregate by patient
  const byPatient = new Map<
    string,
    {
      patient_name: string
      total_overdue: number
      overdue_count: number
      oldest_due_date: string
    }
  >()

  for (const charge of charges) {
    const patientName =
      (charge.patients as unknown as { full_name: string })?.full_name ?? "—"
    const existing = byPatient.get(charge.patient_id)

    if (existing) {
      existing.total_overdue += Number(charge.amount)
      existing.overdue_count += 1
      // oldest_due_date is already set (ordered ascending)
    } else {
      byPatient.set(charge.patient_id, {
        patient_name: patientName,
        total_overdue: Number(charge.amount),
        overdue_count: 1,
        oldest_due_date: charge.due_date,
      })
    }
  }

  return Array.from(byPatient.entries()).map(
    ([patient_id, data]) => ({
      patient_id,
      ...data,
    }),
  )
}

async function DefaultersServer() {
  const defaulters = await getDefaulters()
  return <DefaultersList defaulters={defaulters} />
}

/**
 * Financeiro sub-navigation tabs.
 */
function FinanceiroTabs() {
  return (
    <nav className="flex gap-1 border-b pb-1" aria-label="Financeiro">
      <Link
        href="/financeiro/cobrancas"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
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
        className="rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
      >
        Inadimplentes
      </Link>
    </nav>
  )
}

export default function InadimplentesPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>

      <FinanceiroTabs />

      <Suspense fallback={<DefaultersListSkeleton />}>
        <DefaultersServer />
      </Suspense>
    </div>
  )
}
