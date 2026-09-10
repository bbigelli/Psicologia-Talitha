"use client"

/**
 * Patient profile component — displays read-only patient data,
 * psychologist info (CRP, specialty), and consent management.
 *
 * No e-Psi field (E5).
 * Discrete language throughout.
 *
 * @see wireframe B.10 (Perfil e Consentimentos do Paciente)
 * @see emenda E5
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LogOut, Loader2 } from "lucide-react"

import { revokeConsent } from "@/lib/actions/consents"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ConsentRecord {
  purpose: string
  action: string
  consent_version: string
  occurred_at: string
}

interface PatientProfileProps {
  patient: {
    full_name: string
    email: string
    phone: string | null
    date_of_birth: string
  }
  psychologist: {
    full_name: string
    crp: string | null
    specialty: string | null
  }
  consents: ConsentRecord[]
}

const PURPOSE_LABELS: Record<string, string> = {
  online_therapy: "Termo de atendimento",
  lgpd_clinical: "Dados pessoais (LGPD)",
  lgpd_asaas: "Pagamentos (LGPD)",
  communication: "Lembretes por e-mail",
}

export function PatientProfile({
  patient,
  psychologist,
  consents,
}: PatientProfileProps) {
  const router = useRouter()
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Group consents by purpose — latest action per purpose
  const latestConsents = new Map<string, ConsentRecord>()
  for (const c of consents) {
    if (!latestConsents.has(c.purpose)) {
      latestConsents.set(c.purpose, c)
    }
  }

  function handleRevoke() {
    startTransition(async () => {
      // Revoke LGPD clinical consent
      const result = await revokeConsent({ purpose: "lgpd_clinical" })

      if (result.success) {
        toast.success("Consentimento revogado")
        setRevokeDialogOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  async function handleSignOut() {
    // Client-side signout — import dynamically to avoid server-only issues
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Perfil</h1>

      {/* Psychologist info */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Sobre sua profissional
        </h2>
        <Card className="p-4 space-y-1">
          <p className="font-medium text-foreground">
            {psychologist.full_name}
          </p>
          {psychologist.crp && (
            <p className="text-sm text-muted-foreground">
              {psychologist.crp}
            </p>
          )}
          {psychologist.specialty && (
            <p className="text-sm text-muted-foreground">
              {psychologist.specialty}
            </p>
          )}
        </Card>
      </div>

      <Separator />

      {/* Consents */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Seus consentimentos
        </h2>
        <div className="space-y-2">
          {Array.from(latestConsents.entries()).map(([purpose, record]) => (
            <Card key={purpose} className="p-4 space-y-1">
              <p className="font-medium text-foreground">
                {PURPOSE_LABELS[purpose] || purpose}
              </p>
              <p className="text-sm text-muted-foreground">
                {record.action === "accept"
                  ? `Aceito em ${formatDate(record.occurred_at)}`
                  : `Revogado em ${formatDate(record.occurred_at)}`}
              </p>
              <p className="text-xs text-muted-foreground">
                Versao {record.consent_version}
              </p>

              {/* Revoke button for LGPD consent */}
              {purpose === "lgpd_clinical" &&
                record.action === "accept" && (
                  <Dialog
                    open={revokeDialogOpen}
                    onOpenChange={setRevokeDialogOpen}
                  >
                    <DialogTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 text-destructive border-destructive/50"
                        />
                      }
                    >
                      Revogar consentimento
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Revogar consentimento</DialogTitle>
                        <DialogDescription>
                          Ao revogar o consentimento, seu acompanhamento sera
                          encerrado. Seus dados serao mantidos pelo prazo legal
                          (minimo 5 anos). Deseja prosseguir?
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setRevokeDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleRevoke}
                          disabled={isPending}
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Revogando...
                            </>
                          ) : (
                            "Confirmar revogacao"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Sign out */}
      <Button
        variant="ghost"
        className="text-destructive w-full justify-start"
        onClick={handleSignOut}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sair da conta
      </Button>
    </div>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
