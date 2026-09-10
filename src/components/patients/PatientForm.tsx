"use client"

/**
 * Patient registration form.
 *
 * Validates: name, email, phone, CPF, date of birth (>= 18 years).
 * On submit, calls createPatient server action.
 *
 * @see wireframe A.09 (formulario), US-002
 */

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createPatient } from "@/lib/actions/patients"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import type { ActionResult } from "@/types/actions"

type CreatePatientResult = ActionResult<{
  patientId: string
  emailSent: boolean
} | {
  emailSent: false
  error: string
}>

export function PatientForm() {
  const router = useRouter()

  async function handleSubmit(
    _prev: CreatePatientResult | null,
    formData: FormData,
  ): Promise<CreatePatientResult> {
    const input = {
      full_name: formData.get("full_name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || "",
      cpf: formData.get("cpf") as string,
      date_of_birth: formData.get("date_of_birth") as string,
    }

    const result = await createPatient(input)
    return result
  }

  const [state, formAction, pending] = useActionState(handleSubmit, null)

  useEffect(() => {
    if (!state) return

    if (state.success) {
      const data = state.data
      if ("error" in data) {
        // Duplicate CPF or email
        toast.error(data.error)
      } else if (data.emailSent) {
        toast.success("Paciente cadastrado e convite enviado por e-mail")
        router.push("/pacientes")
      } else {
        toast.warning(
          "Paciente cadastrado, mas o convite nao foi enviado. Reenvie pela lista.",
        )
        router.push("/pacientes")
      }
    }

    if (!state.success) {
      toast.error(state.error)
    }
  }, [state, router])

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nome completo *</Label>
          <Input
            id="full_name"
            name="full_name"
            placeholder="Nome completo do paciente"
            required
            minLength={3}
            maxLength={200}
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="paciente@email.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="(11) 99999-9999"
            autoComplete="tel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cpf">CPF *</Label>
          <Input
            id="cpf"
            name="cpf"
            placeholder="000.000.000-00"
            required
            maxLength={14}
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_of_birth">Data de nascimento *</Label>
          <Input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            required
            autoComplete="bday"
          />
          <p className="text-xs text-muted-foreground">
            A pratica atende exclusivamente pacientes maiores de 18 anos.
          </p>
        </div>

        {state && !state.success && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        {state?.success && "error" in state.data && (
          <p className="text-sm text-destructive">{state.data.error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/pacientes")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Cadastrando..." : "Cadastrar paciente"}
          </Button>
        </div>
      </form>
    </Card>
  )
}
