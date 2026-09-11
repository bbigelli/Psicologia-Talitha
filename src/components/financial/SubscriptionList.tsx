"use client"

/**
 * Subscription list component.
 *
 * Shows active, paused, and cancelled subscriptions with
 * session usage tracking per cycle.
 *
 * @see US-103
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cancelSubscription } from "@/lib/actions/charges"
import { toast } from "sonner"
import { useState } from "react"

export interface SubscriptionListItem {
  id: string
  patient_name: string
  monthly_value: number
  billing_day: number
  sessions_per_cycle: number
  sessions_used_in_cycle: number
  status: string
  created_at: string
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

const STATUS_LABELS: Record<string, string> = {
  pending_creation: "Processando",
  active: "Ativa",
  paused: "Pausada",
  cancelled: "Cancelada",
  creation_failed: "Falha na criacao",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_creation: "secondary",
  active: "default",
  paused: "secondary",
  cancelled: "outline",
  creation_failed: "destructive",
}

interface SubscriptionCardProps {
  subscription: SubscriptionListItem
}

function SubscriptionCard({ subscription: sub }: SubscriptionCardProps) {
  const [cancelling, setCancelling] = useState(false)

  const sessionsRemaining = sub.sessions_per_cycle - sub.sessions_used_in_cycle
  const isExhausted = sessionsRemaining <= 0

  async function handleCancel() {
    setCancelling(true)
    const result = await cancelSubscription({ subscription_id: sub.id })
    setCancelling(false)

    if (result.success && result.data?.error) {
      toast.error(result.data.error)
    } else if (result.success) {
      toast.success("Assinatura cancelada.")
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="font-medium">{sub.patient_name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(sub.monthly_value)}/mes - Dia {sub.billing_day}
          </p>
          <p className="text-sm">
            Sessoes: {sub.sessions_used_in_cycle}/{sub.sessions_per_cycle}
            {isExhausted && (
              <span className="ml-2 text-xs text-destructive">
                Pacote esgotado
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={STATUS_VARIANTS[sub.status]}>
            {STATUS_LABELS[sub.status]}
          </Badge>
          {sub.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-destructive"
            >
              {cancelling ? "Cancelando..." : "Cancelar"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

interface SubscriptionListProps {
  subscriptions: SubscriptionListItem[]
}

export function SubscriptionList({ subscriptions }: SubscriptionListProps) {
  if (subscriptions.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Nenhuma assinatura cadastrada.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {subscriptions.map((sub) => (
        <SubscriptionCard key={sub.id} subscription={sub} />
      ))}
    </div>
  )
}

export function SubscriptionListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}
