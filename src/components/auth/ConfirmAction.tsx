"use client"

/**
 * ConfirmAction — renders the confirmation page and handles POST.
 *
 * GET only renders (this component on page load).
 * POST via Server Action executes the action.
 *
 * Shows minimal information (date, time) — never patient name.
 *
 * @see architecture.md §8.3, §18 requirement 5
 * @see US-305
 */

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { confirmEmailAction } from "@/lib/actions/confirm-action"

interface ConfirmActionProps {
  status: "valid" | "invalid" | "used" | "expired"
  token?: string
  purpose?: string
  actionLabel?: string
  sessionDate?: string | null
  sessionTime?: string | null
  message?: string
}

export function ConfirmAction({
  status,
  token,
  purpose,
  actionLabel,
  sessionDate,
  sessionTime,
  message,
}: ConfirmActionProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (status !== "valid") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="p-6 space-y-4">
            <p className="text-lg font-medium">
              {status === "used"
                ? "Acao ja processada"
                : status === "expired"
                  ? "Link expirado"
                  : "Link invalido"}
            </p>
            <p className="text-sm text-muted-foreground">
              {message}
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/login")}
            >
              Ir para o portal
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  function handleConfirm() {
    if (!token || !purpose) return

    startTransition(async () => {
      const result = await confirmEmailAction({
        token,
        purpose,
      })

      if (result.success) {
        toast.success(
          purpose === "confirm_attendance"
            ? "Presenca confirmada com sucesso."
            : "Compromisso cancelado.",
        )
        router.push("/login")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-lg">
            {actionLabel || "Confirmar"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {sessionDate && (
            <div>
              <p className="text-sm capitalize text-muted-foreground">
                {sessionDate}
              </p>
              {sessionTime && (
                <p className="text-lg font-medium">{sessionTime}</p>
              )}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Processando..." : actionLabel || "Confirmar"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Ao clicar, voce esta confirmando esta acao.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
