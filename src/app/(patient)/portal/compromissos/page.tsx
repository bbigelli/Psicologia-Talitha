import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { PatientSessionList } from "@/components/schedule/PatientSessionList"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Compromissos | Talitha",
}

export const dynamic = "force-dynamic"

async function SessionListContent() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Get patient record
  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!patient) redirect("/login")

  // Fetch next 10 future sessions — explicit column list
  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, scheduled_at, duration_minutes, status, payment_status",
    )
    .eq("patient_id", patient.id)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(10)

  const mapped = (sessions ?? []).map((s) => ({
    id: s.id,
    scheduledAt: s.scheduled_at,
    durationMinutes: s.duration_minutes,
    status: s.status,
    paymentStatus: s.payment_status,
  }))

  return <PatientSessionList sessions={mapped} />
}

function SessionListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}

export default function CompromissosPage() {
  return (
    <div className="container max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Meus compromissos</h1>
      <Suspense fallback={<SessionListSkeleton />}>
        <SessionListContent />
      </Suspense>
    </div>
  )
}
