"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { MfaCodeInput } from "@/components/auth/MfaCodeInput"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

export function MfaSetup() {
  const router = useRouter()
  const [factorId, setFactorId] = useState("")
  const [qrCode, setQrCode] = useState("")
  const [secret, setSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)
  const [code, setCode] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isEnrolling, setIsEnrolling] = useState(true)
  const [verified, setVerified] = useState(false)
  const [savedSecret, setSavedSecret] = useState(false)

  const enrollMfa = useCallback(async () => {
    setIsEnrolling(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Talitha Psicologia",
      })

      if (error || !data) {
        toast.error("Nao foi possivel configurar a autenticacao segura.")
        return
      }

      setFactorId(data.id)
      if (data.totp?.qr_code) {
        setQrCode(data.totp.qr_code)
      }
      if (data.totp?.secret) {
        setSecret(data.totp.secret)
      }
    } catch {
      toast.error("Erro ao configurar. Tente novamente.")
    } finally {
      setIsEnrolling(false)
    }
  }, [])

  useEffect(() => {
    enrollMfa()
  }, [enrollMfa])

  async function handleVerify() {
    if (code.length !== 6) return

    setIsVerifying(true)
    setHasError(false)

    try {
      const supabase = createClient()

      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId })

      if (challengeError || !challengeData) {
        toast.error("Erro ao verificar codigo.")
        setIsVerifying(false)
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
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

      // MFA verified — show secret backup confirmation
      setVerified(true)
    } catch {
      toast.error("Erro ao verificar. Tente novamente.")
    } finally {
      setIsVerifying(false)
    }
  }

  function handleComplete() {
    router.push("/onboarding")
    router.refresh()
  }

  if (isEnrolling) {
    return (
      <Card className="shadow-lg">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  // After verification: show backup instructions
  if (verified) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">
            Autenticacao configurada!
          </CardTitle>
          <CardDescription>
            Guarde a chave secreta abaixo em lugar seguro. Se perder acesso ao
            seu app autenticador, voce precisara dela para reconfigura-lo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-4 font-mono text-sm break-all text-center leading-relaxed">
            {secret}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Esta e a mesma chave usada para configurar o app autenticador. Com
            ela, voce pode reconfigurar o TOTP em qualquer app autenticador.
          </p>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="saved-secret"
              checked={savedSecret}
              onCheckedChange={(checked) => setSavedSecret(checked === true)}
            />
            <Label htmlFor="saved-secret" className="text-sm leading-tight">
              Salvei a chave secreta em lugar seguro
            </Label>
          </div>

          <Button
            className="w-full"
            disabled={!savedSecret}
            onClick={handleComplete}
          >
            Concluir
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-xl">
          Configurar autenticacao segura
        </CardTitle>
        <CardDescription>
          Para proteger os dados dos seus pacientes, configure um app
          autenticador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">1. Escaneie o QR Code</p>
          {qrCode && (
            <div className="flex justify-center">
              {/* Supabase returns QR as data URI SVG */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode}
                alt="QR Code para configurar autenticador"
                width={200}
                height={200}
                className="rounded-md"
              />
            </div>
          )}
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? "Ocultar codigo manual" : "Nao consegue escanear?"}
          </button>
          {showSecret && secret && (
            <div className="rounded-md bg-muted p-3 font-mono text-xs break-all text-center">
              {secret}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">2. Digite o codigo</p>
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
        </div>

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
            "Verificar e continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
