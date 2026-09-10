"use client"

/**
 * RescheduleDialog — dialog for rescheduling a session.
 *
 * The trigger fn_sessions_on_reschedule handles room_name
 * regeneration and waiting_since/admitted_at cleanup.
 *
 * @see wireframe A.06
 * @see US-307
 */

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { rescheduleSession } from "@/lib/actions/sessions"

interface RescheduleDialogProps {
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRescheduled: () => void
}

export function RescheduleDialog({
  sessionId,
  open,
  onOpenChange,
  onRescheduled,
}: RescheduleDialogProps) {
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleReschedule() {
    if (!newDate || !newTime) {
      toast.error("Preencha a data e o horario.")
      return
    }

    startTransition(async () => {
      const result = await rescheduleSession({
        session_id: sessionId,
        new_date: newDate,
        new_time: newTime,
      })

      if (result.success) {
        toast.success("Sessao remarcada com sucesso.")
        setNewDate("")
        setNewTime("")
        onRescheduled()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remarcar sessao</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-date">Nova data</Label>
            <Input
              id="new-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-time">Novo horario</Label>
            <Input
              id="new-time"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Voltar
          </Button>
          <Button onClick={handleReschedule} disabled={isPending}>
            {isPending ? "Remarcando..." : "Confirmar remarcacao"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
