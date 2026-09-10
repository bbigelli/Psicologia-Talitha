"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import {
  passwordRecoverySchema,
  type PasswordRecoveryInput,
} from "@/schemas/auth"
import { createClient } from "@/lib/supabase/client"
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

export function PasswordRecovery() {
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordRecoveryInput>({
    resolver: zodResolver(passwordRecoverySchema),
  })

  async function onSubmit(data: PasswordRecoveryInput) {
    setIsLoading(true)
    try {
      const supabase = createClient()

      // Always show generic message — never reveal if email exists
      await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/recuperar-senha/nova`,
      })

      setSent(true)
    } catch {
      // Even on error, show generic message
      setSent(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Verifique seu e-mail</CardTitle>
          <CardDescription>
            Se este e-mail estiver cadastrado, voce recebera as instrucoes para
            redefinir sua senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="/login"
            className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </a>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Esqueci minha senha</CardTitle>
        <CardDescription>
          Digite seu e-mail para receber as instrucoes de recuperacao.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar instrucoes"
            )}
          </Button>

          <div className="text-center">
            <a
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
