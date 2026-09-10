import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { UserPlus } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import {
  PatientList,
  PatientListSkeleton,
  type PatientListItem,
} from "@/components/patients/PatientList"

export const metadata: Metadata = {
  title: "Pacientes",
}

/**
 * Fetch patients for the current psychologist.
 *
 * Uses explicit column list — never select('*') on tables with ciphertext.
 * RLS ensures only patients belonging to this psychologist are returned.
 *
 * @see architecture.md §16 rule 18 (select('*') prohibited)
 */
async function getPatients(): Promise<PatientListItem[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("patients")
    .select("id, full_name, email, status, created_at")
    .order("created_at", { ascending: false })

  return (data ?? []) as PatientListItem[]
}

async function PatientListServer() {
  const patients = await getPatients()
  return <PatientList patients={patients} />
}

export default function PacientesPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Pacientes</h1>
        <Button render={<Link href="/pacientes/novo" />}>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo
        </Button>
      </div>

      <Suspense fallback={<PatientListSkeleton />}>
        <PatientListServer />
      </Suspense>
    </div>
  )
}
