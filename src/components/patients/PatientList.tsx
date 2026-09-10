"use client"

/**
 * Patient list with search and status badges.
 *
 * Loaded server-side, passed as props. Resend invite is a client action.
 *
 * @see wireframe A.07 (Lista de Pacientes)
 */

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Search, UserPlus, Users, Send } from "lucide-react"

import { resendInvite } from "@/lib/actions/patients"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export interface PatientListItem {
  id: string
  full_name: string
  email: string
  status: string
  created_at: string
}

interface PatientListProps {
  patients: PatientListItem[]
}

const STATUS_LABELS: Record<string, string> = {
  invited: "Convite pendente",
  active: "Ativo",
  inactive: "Inativo",
  treatment_ended: "Encerrado",
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  invited: "secondary",
  active: "default",
  inactive: "outline",
  treatment_ended: "destructive",
}

export function PatientList({ patients }: PatientListProps) {
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()
  const [resendingId, setResendingId] = useState<string | null>(null)

  const filtered = patients.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()),
  )

  function handleResend(patientId: string) {
    setResendingId(patientId)
    startTransition(async () => {
      const result = await resendInvite({ patientId })
      if (result.success) {
        toast.success("Convite reenviado com sucesso")
      } else {
        toast.error(result.error)
      }
      setResendingId(null)
    })
  }

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Users className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">
          Voce ainda nao tem pacientes cadastrados.
        </p>
        <Button render={<Link href="/pacientes/novo" />}>
          <UserPlus className="mr-2 h-4 w-4" />
          Cadastrar primeiro paciente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 && search && (
        <p className="py-8 text-center text-muted-foreground">
          Nenhum paciente encontrado para &quot;{search}&quot;.
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((patient) => (
          <Card key={patient.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/pacientes/${patient.id}`}
                className="flex-1 min-w-0"
              >
                <p className="font-medium text-foreground truncate">
                  {patient.full_name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={STATUS_VARIANTS[patient.status] || "outline"}>
                    {STATUS_LABELS[patient.status] || patient.status}
                  </Badge>
                </div>
              </Link>

              {patient.status === "invited" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResend(patient.id)}
                  disabled={isPending && resendingId === patient.id}
                  title="Reenviar convite"
                >
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Reenviar convite</span>
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function PatientListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}
