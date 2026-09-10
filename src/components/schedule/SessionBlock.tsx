"use client"

/**
 * SessionBlock — a single session slot on the schedule.
 *
 * Shows patient name, time range, status badge, and payment indicator.
 * Uses color-coded left border per status:
 *   - confirmed/scheduled → success (green)
 *   - cancelled → muted
 *   - in_progress → primary
 *   - no_show → destructive
 *
 * @see wireframe A.06
 */

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { formatTimeBR, getEndTimeBR } from "@/hooks/useSchedule"
import type { SessionStatus, PaymentStatus } from "@/schemas/session"

export interface SessionBlockData {
  id: string
  patientName: string
  scheduledAt: string
  durationMinutes: number
  status: SessionStatus
  paymentStatus: PaymentStatus
  isRecurring: boolean
}

interface SessionBlockProps {
  session: SessionBlockData
  onClick?: (session: SessionBlockData) => void
  compact?: boolean
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  in_progress: "Em andamento",
  completed: "Concluida",
  cancelled: "Cancelada",
  no_show: "Nao compareceu",
}

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Vencido",
  refunded: "Reembolsado",
  waived: "Isento",
}

const STATUS_BORDER: Record<SessionStatus, string> = {
  scheduled: "border-l-warning",
  confirmed: "border-l-success",
  in_progress: "border-l-primary",
  completed: "border-l-muted-foreground",
  cancelled: "border-l-muted-foreground opacity-60",
  no_show: "border-l-destructive",
}

const PAYMENT_VARIANT: Record<
  PaymentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  paid: "default",
  overdue: "destructive",
  refunded: "outline",
  waived: "outline",
}

export function SessionBlock({
  session,
  onClick,
  compact = false,
}: SessionBlockProps) {
  const startTime = formatTimeBR(session.scheduledAt)
  const endTime = getEndTimeBR(
    session.scheduledAt,
    session.durationMinutes,
  )
  const isCancelled = session.status === "cancelled"

  return (
    <button
      type="button"
      onClick={() => onClick?.(session)}
      className={cn(
        "w-full rounded-md border border-l-4 bg-card p-2 text-left transition-colors hover:bg-accent/50",
        STATUS_BORDER[session.status],
        isCancelled && "line-through",
        compact ? "p-1.5" : "p-2 sm:p-3",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={cn(
            "text-sm font-medium",
            isCancelled && "text-muted-foreground",
          )}
        >
          {session.patientName}
        </span>
        {!compact && !isCancelled && (
          <Badge
            variant={PAYMENT_VARIANT[session.paymentStatus]}
            className="shrink-0 text-[10px]"
          >
            {PAYMENT_LABELS[session.paymentStatus]}
          </Badge>
        )}
      </div>

      <div className="mt-0.5 text-xs text-muted-foreground">
        {startTime} - {endTime}
      </div>

      {!compact && (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {STATUS_LABELS[session.status]}
          </span>
          {session.isRecurring && (
            <span className="text-[10px] text-muted-foreground">
              • Recorrente
            </span>
          )}
        </div>
      )}
    </button>
  )
}
