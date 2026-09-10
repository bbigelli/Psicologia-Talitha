"use client"

/**
 * PatientSessionList — upcoming sessions for the patient portal.
 *
 * Shows next 10 sessions with date, time, status.
 * "Entrar na Sala" button enabled 15 minutes before session.
 * Cancelled sessions shown with strikethrough and no action button.
 *
 * @see wireframe B.04, B.05
 * @see US-308
 */

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatTimeBR, getEndTimeBR } from "@/hooks/useSchedule"

const BRAZIL_TZ = "America/Sao_Paulo"

interface PatientSession {
  id: string
  scheduledAt: string
  durationMinutes: number
  status: string
  paymentStatus: string
}

interface PatientSessionListProps {
  sessions: PatientSession[]
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  in_progress: "Em andamento",
  cancelled: "Cancelada",
}

export function PatientSessionList({
  sessions,
}: PatientSessionListProps) {
  if (sessions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Voce nao tem compromissos agendados. Entre em contato com sua
        profissional.
      </p>
    )
  }

  const now = new Date()

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const sessionDate = new Date(session.scheduledAt)
        const isCancelled = session.status === "cancelled"
        const minutesUntil =
          (sessionDate.getTime() - now.getTime()) / 60_000
        const canEnter = minutesUntil <= 15 && minutesUntil > -30
        const startTime = formatTimeBR(session.scheduledAt)
        const endTime = getEndTimeBR(
          session.scheduledAt,
          session.durationMinutes,
        )

        const dateDisplay = new Intl.DateTimeFormat("pt-BR", {
          timeZone: BRAZIL_TZ,
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(sessionDate)

        return (
          <Card
            key={session.id}
            className={cn(isCancelled && "opacity-60")}
          >
            <CardContent className="flex items-center justify-between p-3">
              <div className={cn(isCancelled && "line-through")}>
                <p className="text-sm font-medium capitalize">
                  {dateDisplay}
                </p>
                <p className="text-xs text-muted-foreground">
                  {startTime} - {endTime}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    isCancelled
                      ? "secondary"
                      : session.status === "confirmed"
                        ? "default"
                        : "outline"
                  }
                  className="text-[10px]"
                >
                  {STATUS_LABELS[session.status] || session.status}
                </Badge>
                {!isCancelled && canEnter && (
                  <Button size="sm" className="text-xs">
                    Entrar na sala
                  </Button>
                )}
                {!isCancelled && !canEnter && minutesUntil > 15 && (
                  <span className="text-[10px] text-muted-foreground">
                    Disponivel as {startTime}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
