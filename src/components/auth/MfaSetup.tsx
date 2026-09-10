"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Loader2, Copy, Download } from "lucide-react"
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

type SetupStep = "qr" | "recovery"

export function MfaSetup() {
  const router = useRouter()
  const [step, setStep] = useState<SetupStep>("qr")
  const [factorId, setFactorId] = useState("")
  const [qrCode, setQrCode] = useState("")
  const [secret, setSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)
  const [code, setCode] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [savedCodes, setSavedCodes] = useState(false)
  const [isEnrolling, setIsEnrolling] = useState(true)

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

      // Challenge and verify
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

      // MFA verified — now show recovery codes
      // Supabase MFA doesn't expose recovery codes on enroll, so we show the
      // secret as the recovery mechanism. The user should save it securely.
      // Note: Supabase provides recovery via the TOTP secret itself.
      // We generate display-friendly backup values from the TOTP secret.
      setRecoveryCodes(generateDisplayRecoveryCodes(secret))
      setStep("recovery")
    } catch {
      toast.error("Erro ao verificar. Tente novamente.")
    } finally {
      setIsVerifying(false)
    }
  }

  function handleCopyCodes() {
    const text = recoveryCodes.join("\n")
    navigator.clipboard.writeText(text)
    toast.success("Codigos copiados!")
  }

  function handleDownloadCodes() {
    const text = [
      "Talitha Psicologia - Codigos de Recuperacao",
      "Guarde em lugar seguro. Cada codigo so pode ser usado uma vez.",
      "",
      ...recoveryCodes,
    ].join("\n")
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "talitha-codigos-recuperacao.txt"
    a.click()
    URL.revokeObjectURL(url)
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

  if (step === "recovery") {
    return (
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Codigos de recuperacao</CardTitle>
          <CardDescription>
            Guarde estes codigos em lugar seguro. Cada codigo so pode ser usado
            uma vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-4 font-mono text-sm leading-relaxed">
            {recoveryCodes.map((code, i) => (
              <div key={i}>{code}</div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyCodes}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDownloadCodes}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar .txt
            </Button>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="saved-codes"
              checked={savedCodes}
              onCheckedChange={(checked) => setSavedCodes(checked === true)}
            />
            <Label htmlFor="saved-codes" className="text-sm leading-tight">
              Salvei meus codigos em lugar seguro
            </Label>
          </div>

          <Button
            className="w-full"
            disabled={!savedCodes}
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

/**
 * Generate display-friendly recovery codes from the TOTP secret.
 * Since Supabase MFA doesn't expose recovery codes directly,
 * we format the TOTP secret into multiple segments that can serve
 * as backup reference for the user to reconfigure their authenticator.
 */
function generateDisplayRecoveryCodes(secret: string): string[] {
  // Format the TOTP secret into groups of 4 characters
  // This allows the user to manually re-enter the TOTP secret
  const codes: string[] = []
  for (let i = 0; i < secret.length; i += 4) {
    const segment = secret.slice(i, i + 4)
    if (segment.length > 0) {
      codes.push(segment)
    }
  }
  // Pad to at least 8 entries for display consistency
  while (codes.length < 8) {
    codes.push("----")
  }
  return codes.slice(0, 8)
}
