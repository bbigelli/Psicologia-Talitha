/**
 * Defaulters list component.
 *
 * Shows patients with overdue charges: name, total amount,
 * number of overdue charges, oldest overdue age.
 *
 * @see wireframe A.14
 * @see US-106
 */

import { CheckCircle } from "lucide-react"
import { Card } from "@/components/ui/card"

export interface DefaulterItem {
  patient_id: string
  patient_name: string
  total_overdue: number
  overdue_count: number
  oldest_due_date: string
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function daysOverdue(dueDateStr: string): number {
  const dueDate = new Date(dueDateStr + "T00:00:00Z")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = today.getTime() - dueDate.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

interface DefaultersListProps {
  defaulters: DefaulterItem[]
}

export function DefaultersList({ defaulters }: DefaultersListProps) {
  if (defaulters.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CheckCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">
          Nenhum paciente inadimplente. Todos os pagamentos estao em dia!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {defaulters.map((d) => (
        <Card key={d.patient_id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-medium">{d.patient_name}</p>
              <p className="text-sm text-destructive">
                {formatCurrency(d.total_overdue)} em aberto
              </p>
              <p className="text-sm text-muted-foreground">
                {d.overdue_count}{" "}
                {d.overdue_count === 1 ? "cobranca vencida" : "cobrancas vencidas"}
              </p>
              <p className="text-sm text-muted-foreground">
                Mais antiga: {daysOverdue(d.oldest_due_date)} dias
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function DefaultersListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}
