"use client"

/**
 * Online Therapy Consent Form — Step 1 of 2.
 *
 * CFP term with E7 clauses (online format, cancellation, connection drop).
 *
 * @see wireframe B.02
 * @see emenda E7
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { acceptConsent } from "@/lib/actions/consents"
import { Button } from "@/components/ui/button"
import { ConsentSection } from "./ConsentSection"
import {
  CONSENT_TEXT_ONLINE_THERAPY,
  CONSENT_HASHES,
} from "@/lib/consent-texts"

export function OnlineTherapyConsentForm() {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    startTransition(async () => {
      const result = await acceptConsent({
        purpose: "online_therapy",
        consent_text_hash: CONSENT_HASHES.online_therapy,
      })

      if (result.success) {
        router.push("/termos/lgpd")
      } else {
        toast.error(
          result.error ||
            "Nao foi possivel registrar seu aceite. Tente novamente.",
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Termo de Consentimento para Atendimento Online
        </h1>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="h-2 w-2 rounded-full bg-muted" />
          <span className="text-xs text-muted-foreground ml-1">
            Etapa 1 de 2
          </span>
        </div>
      </div>

      <ConsentSection
        title="Termo de Atendimento Online"
        required={true}
        text={CONSENT_TEXT_ONLINE_THERAPY}
        checkboxLabel="Li e aceito o Termo de Consentimento para Atendimento Online"
        checked={accepted}
        onCheckedChange={setAccepted}
      />

      <Button
        onClick={handleSubmit}
        disabled={!accepted || isPending}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Registrando...
          </>
        ) : (
          "Aceitar e continuar"
        )}
      </Button>
    </div>
  )
}
