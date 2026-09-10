"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  onboardingFormSchema,
  type OnboardingFormInput,
} from "@/schemas/profile"
import { completeOnboarding } from "@/lib/actions/profile"
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

export function OnboardingForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormInput>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      cancellation_policy_hours: 24,
    },
  })

  async function onSubmit(data: OnboardingFormInput) {
    setIsLoading(true)
    try {
      const result = await completeOnboarding(data)
      if (result.success) {
        toast.success("Perfil salvo com sucesso!")
        router.push("/dashboard")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Nao foi possivel salvar. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">
          Bem-vinda! Configure seu perfil profissional.
        </CardTitle>
        <CardDescription>
          Preencha seus dados para comecar a usar a plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome completo *</Label>
            <Input
              id="full_name"
              placeholder="Seu nome completo"
              {...register("full_name")}
            />
            {errors.full_name && (
              <p className="text-sm text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="crp">CRP *</Label>
            <Input
              id="crp"
              placeholder="CRP 06/12345"
              {...register("crp")}
            />
            <p className="text-xs text-muted-foreground">
              Formato: CRP XX/XXXXX (numero e regiao)
            </p>
            {errors.crp && (
              <p className="text-sm text-destructive">
                {errors.crp.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF *</Label>
            <Input
              id="cpf"
              placeholder="000.000.000-00"
              {...register("cpf")}
            />
            {errors.cpf && (
              <p className="text-sm text-destructive">
                {errors.cpf.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail profissional *</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialty">Especialidade</Label>
            <Input
              id="specialty"
              placeholder="Ex: Psicologia Clinica"
              {...register("specialty")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_session_value">
              Valor padrao da sessao (R$) *
            </Label>
            <Input
              id="default_session_value"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              {...register("default_session_value", { valueAsNumber: true })}
            />
            {errors.default_session_value && (
              <p className="text-sm text-destructive">
                {errors.default_session_value.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancellation_policy_hours">
              Politica de cancelamento (horas)
            </Label>
            <Input
              id="cancellation_policy_hours"
              type="number"
              min="0"
              {...register("cancellation_policy_hours", {
                valueAsNumber: true,
              })}
            />
            <p className="text-xs text-muted-foreground">
              Antecedencia minima para cancelar sem cobranca
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar e comecar"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
