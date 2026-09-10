"use client"

/**
 * LGPD Consent Form — Step 2 of 2.
 *
 * Three segmented sections (security review A4):
 * 1. Clinical data treatment (required)
 * 2. Asaas data sharing (required)
 * 3. Email communications (optional, pre-checked)
 *
 * @see wireframe B.03
 * @see security-review-prd.md A4 (consent by purpose)
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { acceptMultipleConsents } from "@/lib/actions/consents"
import { Button } from "@/components/ui/button"
import { ConsentSection } from "./ConsentSection"
import {
  CONSENT_TEXT_LGPD_CLINICAL,
  CONSENT_TEXT_LGPD_ASAAS,
  CONSENT_TEXT_COMMUNICATION,
  CONSENT_HASHES,
} from "@/lib/consent-texts"

export function LgpdConsentForm() {
  const router = useRouter()
  const [clinicalAccepted, setClinicalAccepted] = useState(false)
  const [asaasAccepted, setAsaasAccepted] = useState(false)
  const [communicationAccepted, setCommunicationAccepted] = useState(true) // pre-checked
  const [isPending, startTransition] = useTransition()

  const allRequiredAccepted = clinicalAccepted && asaasAccepted

  function handleSubmit() {
    startTransition(async () => {
      const consents: Array<{
        purpose: "online_therapy" | "lgpd_clinical" | "lgpd_asaas" | "communication"
        consent_text_hash: string
      }> = [
        {
          purpose: "lgpd_clinical",
          consent_text_hash: CONSENT_HASHES.lgpd_clinical,
        },
        {
          purpose: "lgpd_asaas",
          consent_text_hash: CONSENT_HASHES.lgpd_asaas,
        },
      ]

      // Only include communication consent if accepted
      if (communicationAccepted) {
        consents.push({
          purpose: "communication",
          consent_text_hash: CONSENT_HASHES.communication,
        })
      }

      const result = await acceptMultipleConsents({ consents })

      if (result.success) {
        toast.success("Consentimentos registrados com sucesso")
        router.push("/portal")
      } else {
        toast.error(
          result.error ||
            "Nao foi possivel registrar seus consentimentos. Tente novamente.",
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Autorizacao para Tratamento de Dados Pessoais
        </h1>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground ml-1">
            Etapa 2 de 2
          </span>
        </div>
      </div>

      <ConsentSection
        title="Tratamento Clinico"
        required={true}
        text={CONSENT_TEXT_LGPD_CLINICAL}
        checkboxLabel="Autorizo o tratamento dos meus dados para fins de acompanhamento"
        checked={clinicalAccepted}
        onCheckedChange={setClinicalAccepted}
      />

      <ConsentSection
        title="Pagamentos"
        required={true}
        text={CONSENT_TEXT_LGPD_ASAAS}
        checkboxLabel="Autorizo o compartilhamento com a plataforma Asaas"
        checked={asaasAccepted}
        onCheckedChange={setAsaasAccepted}
      />

      <ConsentSection
        title="Lembretes"
        required={false}
        text={CONSENT_TEXT_COMMUNICATION}
        checkboxLabel="Desejo receber lembretes por e-mail"
        checked={communicationAccepted}
        onCheckedChange={setCommunicationAccepted}
        warning="As notificacoes podem ser visiveis na tela de bloqueio do seu celular."
      />

      <p className="text-sm text-muted-foreground">
        Em caso de revogacao, seus dados clinicos serao mantidos pelo prazo
        legal de 5 anos.
      </p>

      <Button
        onClick={handleSubmit}
        disabled={!allRequiredAccepted || isPending}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Registrando...
          </>
        ) : (
          "Autorizar e continuar"
        )}
      </Button>
    </div>
  )
}
