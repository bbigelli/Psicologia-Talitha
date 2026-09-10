import type { Metadata } from "next"
import { Suspense } from "react"

import { createClient } from "@/lib/supabase/server"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { Calendar } from "lucide-react"

export const metadata: Metadata = {
  title: "Portal do Paciente",
}

/**
 * Portal home page.
 *
 * Shows: greeting, next session, upcoming sessions.
 * Discrete language: "compromissos" not "sessoes de terapia".
 *
 * Data is fetched server-side with explicit column lists.
 * Skeleton loading via Suspense.
 *
 * Sessions, payments, and other data become available in later sprints.
 * This sprint shows the structure with empty states.
 *
 * @see wireframe B.04 (Portal do Paciente Home)
 * @see architecture.md §16 rule 18 (no select(*))
 */

async function PortalContent() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Get patient info
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single()

  const firstName = (profile?.full_name || "").split(" ")[0]

  // Try to get upcoming sessions (Sprint 4 creates sessions)
  // This query will succeed but return empty until sessions exist
  let nextSession: {
    id: string
    scheduled_at: string
    duration_minutes: number
  } | null = null
  let upcomingSessions: Array<{
    id: string
    scheduled_at: string
    duration_minutes: number
  }> = []

  try {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, scheduled_at, duration_minutes, status")
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5)

    if (sessions && sessions.length > 0) {
      nextSession = sessions[0]
      upcomingSessions = sessions.slice(1)
    }
  } catch {
    // Sessions table query may fail if columns aren't as expected
    // Graceful degradation — show empty state
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">
        Ola, {firstName || "Paciente"}
      </h1>

      {/* Next session card */}
      {nextSession ? (
        <Card className="bg-primary/5 border-primary/20 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Proximo compromisso
          </p>
          <p className="text-lg font-medium text-foreground">
            {formatDate(nextSession.scheduled_at)}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatTime(nextSession.scheduled_at)} —{" "}
            {formatEndTime(
              nextSession.scheduled_at,
              nextSession.duration_minutes,
            )}
          </p>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            Voce nao tem compromissos agendados.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Entre em contato com sua profissional.
          </p>
        </Card>
      )}

      {/* Upcoming sessions list */}
      {upcomingSessions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            Proximos compromissos
          </h2>
          <Card className="divide-y">
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm text-foreground">
                  {formatShortDate(session.scheduled_at)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatTime(session.scheduled_at)}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}

function PortalSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export default function PortalPage() {
  return (
    <div className="p-4 md:p-6">
      <Suspense fallback={<PortalSkeleton />}>
        <PortalContent />
      </Suspense>
    </div>
  )
}

// --- Date formatting helpers (explicit Brazil TZ — never server TZ) ---

const BRAZIL_TZ = "America/Sao_Paulo"

function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TZ,
    weekday: "long",
    day: "numeric",
    month: "short",
  })
}

function formatShortDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString("pt-BR", {
    timeZone: BRAZIL_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString("pt-BR", {
    timeZone: BRAZIL_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatEndTime(iso: string, durationMinutes: number): string {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() + durationMinutes)
  return date.toLocaleTimeString("pt-BR", {
    timeZone: BRAZIL_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
}
