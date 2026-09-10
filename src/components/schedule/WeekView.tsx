"use client"

/**
 * WeekView — weekly schedule grid for the psychologist.
 *
 * Shows 7 days (Mon-Sun) with session blocks distributed by time.
 * Visibility is controlled by the parent (ScheduleClient), not by
 * this component (W2 fix).
 *
 * @see wireframe A.06
 */

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { formatDateBR } from "@/hooks/useSchedule"
import {
  SessionBlock,
  type SessionBlockData,
} from "@/components/schedule/SessionBlock"

interface WeekViewProps {
  weekDates: Date[]
  sessions: SessionBlockData[]
  onSessionClick: (session: SessionBlockData) => void
}

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7:00 to 20:00

export function WeekView({
  weekDates,
  sessions,
  onSessionClick,
}: WeekViewProps) {
  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionBlockData[]>()
    for (const session of sessions) {
      const date = new Date(session.scheduledAt)
      const key = formatDateBR(date)
      const existing = map.get(key) ?? []
      existing.push(session)
      map.set(key, existing)
    }
    return map
  }, [sessions])

  const today = formatDateBR(new Date())

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header row with day names */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
          <div className="p-2" />
          {weekDates.map((date, i) => {
            const dateStr = formatDateBR(date)
            const isToday = dateStr === today
            return (
              <div
                key={dateStr}
                className={cn(
                  "p-2 text-center text-sm font-medium",
                  isToday && "bg-primary/5 text-primary",
                )}
              >
                <div>{DAY_NAMES[i]}</div>
                <div
                  className={cn(
                    "text-lg",
                    isToday &&
                      "inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground",
                  )}
                >
                  {date.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="relative">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-muted/50 min-h-[60px]"
            >
              <div className="p-1 text-right text-xs text-muted-foreground pr-2 pt-0">
                {String(hour).padStart(2, "0")}:00
              </div>
              {weekDates.map((date) => {
                const dateStr = formatDateBR(date)
                const isToday = dateStr === today
                const daySessions = (
                  sessionsByDate.get(dateStr) ?? []
                ).filter((s) => {
                  // Use explicit Brazil timezone to determine the hour slot
                  const formatted = new Intl.DateTimeFormat("en-US", {
                    timeZone: "America/Sao_Paulo",
                    hour: "numeric",
                    hour12: false,
                  }).format(new Date(s.scheduledAt))
                  return parseInt(formatted, 10) === hour
                })

                return (
                  <div
                    key={`${dateStr}-${hour}`}
                    className={cn(
                      "border-l p-0.5",
                      isToday && "bg-primary/5",
                    )}
                  >
                    {daySessions.map((session) => (
                      <SessionBlock
                        key={session.id}
                        session={session}
                        onClick={onSessionClick}
                        compact
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
