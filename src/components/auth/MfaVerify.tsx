"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { MfaCodeInput } from "@/components/auth/MfaCodeInput"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

/**
 * MFA verification — 6-digit TOTP code only.
 *
 * Recovery codes are NOT implemented in this version.
 * If the psychologist loses access to their authenticator, they should
 * reconfigure TOTP using the secret key saved during setup, or
 * contact support for manual identity verification and factor reset.
 */
export function MfaVerify() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [hasError, setHasError] = useState(false)

  async function handleVerify() {
    if (code.length !== 6) return

    setIsVerifying(true)
    setHasError(false)

    try {
      const supabase = createClient()

      // Get the TOTP factor
      const { data: factorsData } =
        await supabase.auth.mfa.listFactors()
      const totpFactor = factorsData?.totp?.[0]

      if (!totpFactor) {
        toast.error("Fator de autenticacao nao encontrado.")
        setIsVerifying(false)
        return
      }

      // Challenge
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: totpFactor.id })

      if (challengeError || !challengeData) {
        toast.error("Erro ao iniciar verificacao.")
        setIsVerifying(false)
        return
      }

      // Verify
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code,
      })

      if (verifyError) {
        setHasError(true)
        setCode("")
        toast.error("Codigo incorreto. Tente novamente.")
        setIsVerifying(false)
        return
      }

      // Session promoted to aal2 — refresh to let middleware redirect
      router.refresh()
    } catch {
      toast.error("Erro ao verificar. Tente novamente.")
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-xl">Verificacao</CardTitle>
        <CardDescription>
          Digite o codigo do seu app autenticador
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MfaCodeInput
          value={code}
          onChange={setCode}
          disabled={isVerifying}
          hasError={hasError}
        />
        {hasError && (
          <p className="text-sm text-destructive text-center">
            Codigo incorreto. Tente novamente.
          </p>
        )}
        <Button
          className="w-full"
          disabled={code.length !== 6 || isVerifying}
          onClick={handleVerify}
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verificando...
            </>
          ) : (
            "Verificar"
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Perdeu acesso ao autenticador? Use a chave secreta salva durante a
          configuracao para reconfigurar o app, ou entre em contato com o
          suporte.
        </p>
      </CardContent>
    </Card>
  )
}
