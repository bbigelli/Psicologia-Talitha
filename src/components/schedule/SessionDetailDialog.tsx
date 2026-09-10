"use client"

/**
 * SessionDetailDialog — shows session details and actions.
 *
 * Actions available:
 * - Cancel (delegates to CancelDialog)
 * - Reschedule (delegates to RescheduleDialog)
 *
 * Prontuario link is disabled until Sprint 7.
 *
 * @see wireframe A.06
 */

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatTimeBR, getEndTimeBR, formatDateDisplay } from "@/hooks/useSchedule"
import type { SessionBlockData } from "@/components/schedule/SessionBlock"
import { CancelDialog } from "@/components/schedule/CancelDialog"
import { RescheduleDialog } from "@/components/schedule/RescheduleDialog"

interface SessionDetailDialogProps {
  session: SessionBlockData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  in_progress: "Em andamento",
  completed: "Concluida",
  cancelled: "Cancelada",
  no_show: "Nao compareceu",
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Vencido",
  refunded: "Reembolsado",
  waived: "Isento",
}

export function SessionDetailDialog({
  session,
  open,
  onOpenChange,
}: SessionDetailDialogProps) {
  const [cancelOpen, setCancelOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)

  if (!session) return null

  const startTime = formatTimeBR(session.scheduledAt)
  const endTime = getEndTimeBR(session.scheduledAt, session.durationMinutes)
  const sessionDate = new Date(session.scheduledAt)
  const canModify = ["scheduled", "confirmed"].includes(session.status)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da sessao</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-lg font-medium">{session.patientName}</p>
              <p className="text-sm capitalize text-muted-foreground">
                {formatDateDisplay(sessionDate)}
              </p>
              <p className="text-sm text-muted-foreground">
                {startTime} - {endTime} ({session.durationMinutes} min)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {STATUS_LABELS[session.status] || session.status}
              </Badge>
              <Badge
                variant={
                  session.paymentStatus === "paid"
                    ? "default"
                    : session.paymentStatus === "overdue"
                      ? "destructive"
                      : "secondary"
                }
              >
                {PAYMENT_LABELS[session.paymentStatus] ||
                  session.paymentStatus}
              </Badge>
              {session.isRecurring && (
                <Badge variant="outline">Recorrente</Badge>
              )}
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row">
              {canModify && (
                <>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setRescheduleOpen(true)}
                  >
                    Remarcar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CancelDialog
        sessionId={session.id}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={() => {
          setCancelOpen(false)
          onOpenChange(false)
        }}
      />

      <RescheduleDialog
        sessionId={session.id}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        onRescheduled={() => {
          setRescheduleOpen(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
