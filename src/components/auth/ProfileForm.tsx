"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  onboardingFormSchema,
  type OnboardingFormInput,
} from "@/schemas/profile"
import { updateProfile } from "@/lib/actions/profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface ProfileFormProps {
  initialData: {
    full_name: string
    crp: string
    phone: string
    email: string
    specialty: string | null
    default_session_value: number | null
    cancellation_policy_hours: number | null
  }
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormInput>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      full_name: initialData.full_name,
      crp: initialData.crp,
      cpf: "", // CPF not pre-filled for security — must re-enter
      phone: initialData.phone,
      email: initialData.email,
      specialty: initialData.specialty ?? "",
      default_session_value: initialData.default_session_value ?? 0,
      cancellation_policy_hours: initialData.cancellation_policy_hours ?? 24,
    },
  })

  async function onSubmit(data: OnboardingFormInput) {
    setIsLoading(true)
    try {
      const result = await updateProfile(data)
      if (result.success) {
        toast.success("Perfil atualizado com sucesso!")
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Nao foi possivel atualizar. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil Profissional</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome completo *</Label>
            <Input id="full_name" {...register("full_name")} />
            {errors.full_name && (
              <p className="text-sm text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="crp">CRP *</Label>
            <Input id="crp" {...register("crp")} />
            {errors.crp && (
              <p className="text-sm text-destructive">
                {errors.crp.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF * (redigite para atualizar)</Label>
            <Input id="cpf" placeholder="000.000.000-00" {...register("cpf")} />
            {errors.cpf && (
              <p className="text-sm text-destructive">
                {errors.cpf.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input id="phone" {...register("phone")} />
            {errors.phone && (
              <p className="text-sm text-destructive">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail profissional *</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialty">Especialidade</Label>
            <Input id="specialty" {...register("specialty")} />
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
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar alteracoes"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
