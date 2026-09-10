import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { NewSessionForm } from "@/components/schedule/NewSessionForm"

export const metadata: Metadata = {
  title: "Nova Sessao | Talitha",
}

export const dynamic = "force-dynamic"

export default async function NewSessionPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Fetch active patients for the select dropdown.
  // Explicit column list — never select('*') with cipher columns.
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name")
    .order("full_name", { ascending: true })

  return (
    <div className="container max-w-lg space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Agendar sessao</h1>
      <NewSessionForm patients={patients ?? []} />
    </div>
  )
}
