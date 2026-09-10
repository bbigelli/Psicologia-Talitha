"use client"

/**
 * useSchedule — client-side schedule navigation hook.
 *
 * Manages the current week/day view state and provides
 * navigation helpers. Data fetching happens in the Server Component;
 * this hook only handles UI state.
 *
 * @see wireframe A.06
 */

import { useState, useMemo, useCallback } from "react"

const BRAZIL_TZ = "America/Sao_Paulo"

/**
 * Get the start of the week (Monday) for a given date.
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Format date to YYYY-MM-DD in Brazil timezone.
 */
export function formatDateBR(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(date)
}

/**
 * Format date to display string in Brazilian Portuguese.
 */
export function formatDateDisplay(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TZ,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

/**
 * Format time from a timestamptz string to HH:MM in Brazil timezone.
 */
export function formatTimeBR(isoString: string): string {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

/**
 * Get the end time string given a start ISO string and duration in minutes.
 */
export function getEndTimeBR(
  isoString: string,
  durationMinutes: number,
): string {
  const start = new Date(isoString)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(end)
}

export type ViewMode = "week" | "day"

export interface UseScheduleReturn {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  currentDate: Date
  weekStart: Date
  weekEnd: Date
  weekDates: Date[]
  navigateNext: () => void
  navigatePrev: () => void
  navigateToday: () => void
  startDateStr: string
  endDateStr: string
}

export function useSchedule(
  initialMode: ViewMode = "week",
): UseScheduleReturn {
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
  }, [weekStart])

  const weekDates = useMemo(() => {
    const dates: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      dates.push(d)
    }
    return dates
  }, [weekStart])

  const navigateNext = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + (viewMode === "week" ? 7 : 1))
      return d
    })
  }, [viewMode])

  const navigatePrev = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - (viewMode === "week" ? 7 : 1))
      return d
    })
  }, [viewMode])

  const navigateToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  const startDateStr = useMemo(() => {
    if (viewMode === "week") {
      return formatDateBR(weekStart)
    }
    return formatDateBR(currentDate)
  }, [viewMode, weekStart, currentDate])

  const endDateStr = useMemo(() => {
    if (viewMode === "week") {
      return formatDateBR(weekEnd)
    }
    return formatDateBR(currentDate)
  }, [viewMode, weekEnd, currentDate])

  return {
    viewMode,
    setViewMode,
    currentDate,
    weekStart,
    weekEnd,
    weekDates,
    navigateNext,
    navigatePrev,
    navigateToday,
    startDateStr,
    endDateStr,
  }
}
