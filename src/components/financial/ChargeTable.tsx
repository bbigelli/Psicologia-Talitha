"use client"

/**
 * Charges table with sorting and filtering.
 *
 * Manual sort/filter implementation using React state and the
 * existing shadcn Table component. TanStack Table v9 deferred
 * to avoid API incompatibility during sprint.
 *
 * Displays: patient name, amount, due date, payment method, status.
 *
 * @see wireframe (Tab Financeiro in patient detail)
 * @see backlog Task 5.2
 */

import { useState, useMemo } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChargeStatusBadge } from "@/components/financial/ChargeStatusBadge"
import {
  PAYMENT_METHOD_LABELS,
  type ChargeStatus,
  type PaymentMethod,
} from "@/schemas/charge"

export interface ChargeListItem {
  id: string
  patient_name: string
  amount: number
  due_date: string
  payment_method: PaymentMethod | null
  status: ChargeStatus
  created_at: string
  asaas_payment_id: string | null
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

type SortKey = keyof ChargeListItem
type SortDir = "asc" | "desc"

interface ChargeTableProps {
  charges: ChargeListItem[]
}

export function ChargeTable({ charges }: ChargeTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [filter, setFilter] = useState("")

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3" />
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    )
  }

  const filtered = useMemo(() => {
    if (!filter) return charges
    const lower = filter.toLowerCase()
    return charges.filter((c) =>
      c.patient_name.toLowerCase().includes(lower),
    )
  }, [charges, filter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por paciente..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => toggleSort("patient_name")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Paciente
                  <SortIcon col="patient_name" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => toggleSort("amount")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Valor
                  <SortIcon col="amount" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => toggleSort("due_date")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Vencimento
                  <SortIcon col="due_date" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell">Metodo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">
                <Button
                  variant="ghost"
                  onClick={() => toggleSort("created_at")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Criada em
                  <SortIcon col="created_at" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length > 0 ? (
              sorted.map((charge) => (
                <TableRow key={charge.id}>
                  <TableCell className="font-medium">
                    {charge.patient_name}
                  </TableCell>
                  <TableCell>{formatCurrency(charge.amount)}</TableCell>
                  <TableCell>{formatDate(charge.due_date)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {charge.payment_method
                      ? PAYMENT_METHOD_LABELS[charge.payment_method]
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <ChargeStatusBadge status={charge.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(charge.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhuma cobranca encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function ChargeTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  )
}
