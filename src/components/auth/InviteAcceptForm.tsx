"use client"

/**
 * Invite acceptance form — patient creates their password.
 *
 * @see wireframe B.01 (Primeiro Acesso)
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { acceptInvite } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"

interface InviteAcceptFormProps {
  token: string
  patientName?: string
}

export function InviteAcceptForm({ token, patientName }: InviteAcceptFormProps) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    // Client-side validation
    if (password.length < 10) {
      setError("A senha deve ter no minimo 10 caracteres")
      return
    }

    if (!/[a-zA-Z]/.test(password)) {
      setError("A senha deve conter pelo menos uma letra")
      return
    }

    if (!/[0-9]/.test(password)) {
      setError("A senha deve conter pelo menos um numero")
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas nao coincidem")
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await acceptInvite(token, password)

      if (result.success) {
        toast.success("Senha criada com sucesso")
        router.push(result.data.redirectTo)
      } else {
        setError(result.error)
        toast.error(result.error)
      }
    })
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Crie sua senha de acesso
          </h1>
          {patientName && (
            <p className="mt-1 text-muted-foreground">
              Ola, {patientName}
            </p>
          )}
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Senha *</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={10}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showPassword ? "Ocultar senha" : "Mostrar senha"}
                </span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimo 10 caracteres, com letra e numero
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha *</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                required
                minLength={10}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showConfirm ? "Ocultar senha" : "Mostrar senha"}
                </span>
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando senha...
              </>
            ) : (
              "Criar senha"
            )}
          </Button>
        </form>
      </div>
    </Card>
  )
}
