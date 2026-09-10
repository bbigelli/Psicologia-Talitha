import { Badge } from "@/components/ui/badge"
import {
  CHARGE_STATUS_LABELS,
  type ChargeStatus,
} from "@/schemas/charge"

/**
 * Status badge for charges with semantic colors.
 *
 * Colors follow the design system tokens:
 * - paid: default (primary/green)
 * - pending/pending_creation: secondary (neutral/amber)
 * - overdue: destructive (red)
 * - refunded/chargeback: outline
 * - cancelled: outline
 *
 * @see wireframe A.13, B.08
 */

const STATUS_VARIANT: Record<
  ChargeStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending_creation: "secondary",
  pending: "secondary",
  overdue: "destructive",
  paid: "default",
  refunded: "outline",
  chargeback: "outline",
  cancelled: "outline",
}

interface ChargeStatusBadgeProps {
  status: ChargeStatus
  className?: string
}

export function ChargeStatusBadge({ status, className }: ChargeStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {CHARGE_STATUS_LABELS[status]}
    </Badge>
  )
}
