import { Suspense } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChargeForm } from "@/components/financial/ChargeForm"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * New charge page — form for creating a charge.
 *
 * @see wireframe A.13
 * @see US-102
 */

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

async function ChargeFormServer() {
  const patients = await getPatients()
  return <ChargeForm patients={patients} />
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

export default function NovaCobrancaPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href="/financeiro/cobrancas" />}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Nova cobranca</h1>
      </div>

      <Card className="max-w-lg p-6">
        <Suspense fallback={<FormSkeleton />}>
          <ChargeFormServer />
        </Suspense>
      </Card>
    </div>
  )
}
