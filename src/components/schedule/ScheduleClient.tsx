"use client"

/**
 * ScheduleClient — client-side schedule with navigation and view switching.
 *
 * Wraps WeekView and DayView with:
 * - View mode toggle (week/day)
 * - Week/day navigation arrows
 * - Session detail dialog on click
 *
 * Data is fetched server-side and passed as prop; this component
 * only handles UI state and navigation triggers reload via searchParams.
 *
 * @see wireframe A.06
 */

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useSchedule, formatDateBR } from "@/hooks/useSchedule"
import { WeekView } from "@/components/schedule/WeekView"
import { DayView } from "@/components/schedule/DayView"
import {
  SessionDetailDialog,
} from "@/components/schedule/SessionDetailDialog"
import type { SessionBlockData } from "@/components/schedule/SessionBlock"
import Link from "next/link"

interface ScheduleClientProps {
  sessions: SessionBlockData[]
}

export function ScheduleClient({ sessions }: ScheduleClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const {
    viewMode,
    setViewMode,
    currentDate,
    weekDates,
    navigateNext,
    navigatePrev,
    navigateToday,
  } = useSchedule(
    (searchParams.get("view") as "week" | "day") || "week",
  )

  const [selectedSession, setSelectedSession] =
    useState<SessionBlockData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const handleSessionClick = useCallback(
    (session: SessionBlockData) => {
      setSelectedSession(session)
      setDetailOpen(true)
    },
    [],
  )

  const handleNav = useCallback(
    (direction: "prev" | "next" | "today") => {
      if (direction === "prev") navigatePrev()
      else if (direction === "next") navigateNext()
      else navigateToday()

      // Update URL params to trigger server data refetch
      const params = new URLSearchParams(searchParams.toString())
      params.set("view", viewMode)

      // For simplicity, we let the client-side state manage the date
      // and reload data when needed
      router.refresh()
    },
    [navigatePrev, navigateNext, navigateToday, searchParams, viewMode, router],
  )

  const weekLabel = (() => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    }
    const start = weekDates[0]
    const end = weekDates[6]
    const startStr = start.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
    })
    const endStr = end.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
    })
    return `${startStr} - ${endStr}`
  })()

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNav("today")}
          >
            Hoje
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleNav("prev")}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[160px] text-center text-sm font-medium capitalize">
              {weekLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleNav("next")}
              aria-label="Proximo"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle — hidden on mobile (DayView is always shown) */}
          <div className="hidden md:flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode("week")}
            >
              Semana
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode("day")}
            >
              Dia
            </Button>
          </div>

          <Link href="/agenda/nova-sessao">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Nova sessao
            </Button>
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">
            Sua agenda esta vazia nesta semana.
          </p>
          <p className="text-sm text-muted-foreground">
            Cadastre pacientes e agende sessoes.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/pacientes/novo">
              <Button variant="outline" size="sm">
                Novo paciente
              </Button>
            </Link>
            <Link href="/agenda/nova-sessao">
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Nova sessao
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Views */}
      {sessions.length > 0 && (
        <>
          {viewMode === "week" ? (
            <WeekView
              weekDates={weekDates}
              sessions={sessions}
              onSessionClick={handleSessionClick}
            />
          ) : (
            <div className="hidden md:block">
              <DayView
                currentDate={currentDate}
                sessions={sessions}
                onSessionClick={handleSessionClick}
              />
            </div>
          )}

          {/* Mobile always shows DayView */}
          <DayView
            currentDate={currentDate}
            sessions={sessions}
            onSessionClick={handleSessionClick}
          />
        </>
      )}

      <SessionDetailDialog
        session={selectedSession}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
