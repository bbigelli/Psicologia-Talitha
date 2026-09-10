"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { resetPasswordSchema, type ResetPasswordInput } from "@/schemas/auth"
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

type ResetStep = "mfa" | "password"

interface ResetPasswordProps {
  /** Whether the user has TOTP factors (requires MFA challenge first) */
  hasMfa: boolean
}

export function ResetPassword({ hasMfa }: ResetPasswordProps) {
  const router = useRouter()
  const [step, setStep] = useState<ResetStep>(hasMfa ? "mfa" : "password")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // MFA state
  const [mfaCode, setMfaCode] = useState("")
  const [mfaError, setMfaError] = useState(false)
  const [mfaVerifying, setMfaVerifying] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  async function handleMfaVerify() {
    if (mfaCode.length !== 6) return

    setMfaVerifying(true)
    setMfaError(false)

    try {
      const supabase = createClient()
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const totpFactor = factorsData?.totp?.[0]

      if (!totpFactor) {
        toast.error("Fator de autenticacao nao encontrado.")
        setMfaVerifying(false)
        return
      }

      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: totpFactor.id })

      if (challengeError || !challengeData) {
        toast.error("Erro ao iniciar verificacao.")
        setMfaVerifying(false)
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: mfaCode,
      })

      if (verifyError) {
        setMfaError(true)
        setMfaCode("")
        toast.error("Codigo incorreto. Tente novamente.")
        setMfaVerifying(false)
        return
      }

      // MFA verified — proceed to password reset
      setStep("password")
    } catch {
      toast.error("Erro ao verificar. Tente novamente.")
    } finally {
      setMfaVerifying(false)
    }
  }

  async function onSubmitPassword(data: ResetPasswordInput) {
    setIsLoading(true)
    try {
      const supabase = createClient()

      const { error } = await supabase.auth.updateUser({
        password: data.password,
      })

      if (error) {
        toast.error("Nao foi possivel alterar a senha. Tente novamente.")
        return
      }

      toast.success("Senha alterada com sucesso!")

      // Sign out to revoke other sessions — user logs in fresh
      await supabase.auth.signOut({ scope: "global" })

      router.push("/login")
      router.refresh()
    } catch {
      toast.error("Erro ao alterar a senha.")
    } finally {
      setIsLoading(false)
    }
  }

  if (step === "mfa") {
    return (
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Verificacao de seguranca</CardTitle>
          <CardDescription>
            Para sua seguranca, confirme sua identidade antes de alterar a
            senha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MfaCodeInput
            value={mfaCode}
            onChange={setMfaCode}
            disabled={mfaVerifying}
            hasError={mfaError}
          />
          {mfaError && (
            <p className="text-sm text-destructive text-center">
              Codigo incorreto. Tente novamente.
            </p>
          )}
          <Button
            className="w-full"
            disabled={mfaCode.length !== 6 || mfaVerifying}
            onClick={handleMfaVerify}
          >
            {mfaVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Verificar"
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Nova senha</CardTitle>
        <CardDescription>
          Defina uma nova senha para sua conta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmitPassword)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Minimo 10 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
                aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Alterando...
              </>
            ) : (
              "Alterar senha"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
