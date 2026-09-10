import Link from "next/link"
import { Suspense } from "react"
import { Plus } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  SubscriptionList,
  SubscriptionListSkeleton,
  type SubscriptionListItem,
} from "@/components/financial/SubscriptionList"
import { SubscriptionForm } from "@/components/financial/SubscriptionForm"

/**
 * Subscriptions page — list + create form.
 *
 * @see US-103
 */

async function getSubscriptions(): Promise<SubscriptionListItem[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("subscriptions")
    .select(
      "id, patient_id, monthly_value, billing_day, sessions_per_cycle, sessions_used_in_cycle, status, created_at, patients(full_name)",
    )
    .order("created_at", { ascending: false })

  if (!data) return []

  return data.map((sub) => ({
    id: sub.id,
    patient_name:
      (sub.patients as unknown as { full_name: string })?.full_name ?? "—",
    monthly_value: Number(sub.monthly_value),
    billing_day: sub.billing_day,
    sessions_per_cycle: sub.sessions_per_cycle,
    sessions_used_in_cycle: sub.sessions_used_in_cycle,
    status: sub.status as "active" | "paused" | "cancelled",
    created_at: sub.created_at,
  }))
}

async function getPatients(): Promise<
  Array<{ id: string; full_name: string }>
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("patients")
    .select("id, full_name")
    .in("status", ["active", "invited"])
    .order("full_name")
  return (data ?? []) as Array<{ id: string; full_name: string }>
}

async function SubscriptionListServer() {
  const subscriptions = await getSubscriptions()
  return <SubscriptionList subscriptions={subscriptions} />
}

async function SubscriptionFormServer() {
  const patients = await getPatients()
  return <SubscriptionForm patients={patients} />
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
        className="rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
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

export default function AssinaturasPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>

      <FinanceiroTabs />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Existing subscriptions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Assinaturas</h2>
          <Suspense fallback={<SubscriptionListSkeleton />}>
            <SubscriptionListServer />
          </Suspense>
        </div>

        {/* New subscription form */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Nova assinatura</h2>
          <Card className="p-6">
            <Suspense
              fallback={
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-md bg-muted"
                    />
                  ))}
                </div>
              }
            >
              <SubscriptionFormServer />
            </Suspense>
          </Card>
        </div>
      </div>
    </div>
  )
}
