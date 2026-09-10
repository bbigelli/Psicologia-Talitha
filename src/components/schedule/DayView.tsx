"use client"

/**
 * DayView — daily schedule for mobile view.
 *
 * Shows sessions for the current day in a list format.
 * Default on mobile (<768px).
 *
 * @see wireframe A.06 (mobile)
 */

import { useMemo } from "react"
import { formatDateBR, formatDateDisplay } from "@/hooks/useSchedule"
import {
  SessionBlock,
  type SessionBlockData,
} from "@/components/schedule/SessionBlock"

interface DayViewProps {
  currentDate: Date
  sessions: SessionBlockData[]
  onSessionClick: (session: SessionBlockData) => void
}

export function DayView({
  currentDate,
  sessions,
  onSessionClick,
}: DayViewProps) {
  const dateStr = formatDateBR(currentDate)

  const daySessions = useMemo(() => {
    return sessions
      .filter((s) => {
        const sessionDate = formatDateBR(new Date(s.scheduledAt))
        return sessionDate === dateStr
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() -
          new Date(b.scheduledAt).getTime(),
      )
  }, [sessions, dateStr])

  return (
    <div className="md:hidden space-y-3">
      <p className="text-center text-sm font-medium capitalize text-muted-foreground">
        {formatDateDisplay(currentDate)}
      </p>

      {daySessions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma sessao neste dia.
        </p>
      ) : (
        <div className="space-y-2">
          {daySessions.map((session) => (
            <SessionBlock
              key={session.id}
              session={session}
              onClick={onSessionClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
