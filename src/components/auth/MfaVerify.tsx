"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { MfaCodeInput } from "@/components/auth/MfaCodeInput"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

type VerifyMode = "totp" | "recovery"

export function MfaVerify() {
  const router = useRouter()
  const [mode, setMode] = useState<VerifyMode>("totp")
  const [code, setCode] = useState("")
  const [recoveryCode, setRecoveryCode] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [hasError, setHasError] = useState(false)

  async function handleVerify() {
    const codeToUse = mode === "totp" ? code : recoveryCode.trim()
    if (!codeToUse) return

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
        code: codeToUse,
      })

      if (verifyError) {
        setHasError(true)
        if (mode === "totp") {
          setCode("")
        }
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
          {mode === "totp"
            ? "Digite o codigo do seu app autenticador"
            : "Digite um codigo de recuperacao"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "totp" ? (
          <>
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
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => {
                  setMode("recovery")
                  setHasError(false)
                }}
              >
                Usar codigo de recuperacao
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="recovery-code">Codigo de recuperacao</Label>
              <Input
                id="recovery-code"
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                disabled={isVerifying}
                placeholder="Digite o codigo"
                className={hasError ? "border-destructive" : ""}
              />
              {hasError && (
                <p className="text-sm text-destructive">
                  Codigo invalido. Tente outro codigo.
                </p>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!recoveryCode.trim() || isVerifying}
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
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => {
                  setMode("totp")
                  setHasError(false)
                }}
              >
                Usar codigo do app
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
