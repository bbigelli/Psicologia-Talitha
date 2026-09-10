/**
 * Patient payment history component.
 *
 * Shows charges for the current patient with status badges and action buttons.
 * - Pending: "Pagar" button (opens Asaas link)
 * - Paid: "Ver documento" button (Sprint 8 — receipts)
 * - Overdue: "Regularizar" button (opens Asaas link)
 * - Subscription charges marked as "Pacote Mensal"
 *
 * @see wireframe B.08
 * @see US-107
 */

import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChargeStatusBadge } from "@/components/financial/ChargeStatusBadge"
import type { ChargeStatus } from "@/schemas/charge"

export interface PatientCharge {
  id: string
  amount: number
  due_date: string
  paid_at: string | null
  status: ChargeStatus
  subscription_id: string | null
  asaas_payment_id: string | null
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function getMonthYear(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z")
  const month = date.toLocaleDateString("pt-BR", { month: "short" })
  const year = date.getFullYear()
  return `${month.charAt(0).toUpperCase() + month.slice(1).replace(".", "")}/${year}`
}

interface PatientPaymentHistoryProps {
  charges: PatientCharge[]
}

export function PatientPaymentHistory({
  charges,
}: PatientPaymentHistoryProps) {
  if (charges.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Nenhum pagamento registrado.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {charges.map((charge) => (
        <Card key={charge.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-medium">
                {getMonthYear(charge.due_date)}
                {charge.subscription_id && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Pacote Mensal
                  </span>
                )}
              </p>
              <p className="text-lg">{formatCurrency(charge.amount)}</p>
              {charge.status === "paid" && charge.paid_at ? (
                <p className="text-sm text-muted-foreground">
                  Pago em: {formatDate(charge.paid_at)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Venc: {formatDate(charge.due_date + "T12:00:00Z")}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <ChargeStatusBadge status={charge.status} />

              {/* Action buttons based on status */}
              {(charge.status === "pending" ||
                charge.status === "pending_creation") &&
                charge.asaas_payment_id && (
                  <a
                    href={`https://sandbox.asaas.com/i/${charge.asaas_payment_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1 text-sm font-medium hover:bg-muted"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Pagar
                  </a>
                )}

              {charge.status === "paid" && (
                <Button variant="outline" size="sm" disabled>
                  Ver documento
                </Button>
              )}

              {charge.status === "overdue" && charge.asaas_payment_id && (
                  <a
                    href={`https://sandbox.asaas.com/i/${charge.asaas_payment_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1 text-sm font-medium text-destructive hover:bg-muted"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Regularizar
                  </a>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function PatientPaymentHistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}
