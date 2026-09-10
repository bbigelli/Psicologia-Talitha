import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getScheduleSessions } from "@/lib/actions/sessions"
import { ScheduleClient } from "@/components/schedule/ScheduleClient"
import { Skeleton } from "@/components/ui/skeleton"
import type { SessionBlockData } from "@/components/schedule/SessionBlock"

export const metadata: Metadata = {
  title: "Agenda | Talitha",
}

export const dynamic = "force-dynamic"

const BRAZIL_TZ = "America/Sao_Paulo"

/**
 * Get the start of the week (Monday) for a given date in Brazil timezone.
 */
function getWeekBounds(): { startDate: string; endDate: string } {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  // Get current day of week (0=Sun, 1=Mon, ...)
  const brazilDate = new Date(
    formatter.format(now).replace(/-/g, "/"),
  )
  const day = brazilDate.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const monday = new Date(brazilDate)
  monday.setDate(monday.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)

  const startDate = formatter.format(monday)
  const endDate = formatter.format(sunday)

  return { startDate, endDate }
}

async function ScheduleContent() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Get the current week bounds
  const { startDate, endDate } = getWeekBounds()

  // Fetch sessions for this week
  const rawSessions = await getScheduleSessions(
    supabase,
    user.id,
    startDate,
    endDate,
  )

  // Fetch patient names for display
  const patientIds = [
    ...new Set(rawSessions.map((s) => s.patient_id)),
  ]
  const patientNames = new Map<string, string>()

  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from("patients")
      .select("id, full_name")
      .in("id", patientIds)

    if (patients) {
      for (const p of patients) {
        patientNames.set(p.id, p.full_name)
      }
    }
  }

  // Transform to SessionBlockData
  const sessions: SessionBlockData[] = rawSessions.map((s) => ({
    id: s.id,
    patientName: patientNames.get(s.patient_id) || "Paciente",
    scheduledAt: s.scheduled_at,
    durationMinutes: s.duration_minutes,
    status: s.status as SessionBlockData["status"],
    paymentStatus: s.payment_status as SessionBlockData["paymentStatus"],
    isRecurring: !!s.recurrence_group_id,
  }))

  return <ScheduleClient sessions={sessions} />
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AgendaPage() {
  return (
    <div className="container max-w-6xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Agenda</h1>
      <Suspense fallback={<ScheduleSkeleton />}>
        <ScheduleContent />
      </Suspense>
    </div>
  )
}
