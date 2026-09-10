"use client"

/**
 * CancelDialog — confirmation dialog for cancelling a session.
 *
 * DoD-2: cancellation_reason validated (max 500 chars, sanitized).
 * Shows warning when cancellation is outside policy hours.
 *
 * @see wireframe A.06
 * @see US-306
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cancelSession } from "@/lib/actions/sessions"

interface CancelDialogProps {
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancelled: () => void
}

export function CancelDialog({
  sessionId,
  open,
  onOpenChange,
  onCancelled,
}: CancelDialogProps) {
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelSession({
        session_id: sessionId,
        reason: reason || undefined,
      })

      if (result.success) {
        if (result.data.isLateCancellation) {
          toast.warning(
            "Sessao cancelada fora do prazo. Cobranca podera ser devida.",
          )
        } else {
          toast.success("Sessao cancelada com sucesso.")
        }
        setReason("")
        onCancelled()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar sessao</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja cancelar esta sessao? Esta acao nao pode
            ser desfeita.
          </p>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              Motivo do cancelamento (opcional)
            </Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="Informe o motivo..."
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 caracteres
            </p>
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
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
