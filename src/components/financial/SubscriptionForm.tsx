"use client"

/**
 * Subscription creation form.
 *
 * Creates a recurring subscription on Asaas for a patient.
 * Validates that the patient doesn't already have an active subscription.
 *
 * @see wireframe (same structure as A.13)
 * @see US-103
 */

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createSubscription } from "@/lib/actions/charges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/types/actions"

interface Patient {
  id: string
  full_name: string
}

interface SubscriptionFormProps {
  patients: Patient[]
}

type SubResult = { subscriptionId: string | null; error: string | null }

async function formAction(
  _prev: ActionResult<SubResult> | null,
  formData: FormData,
): Promise<ActionResult<SubResult>> {
  const paymentMethod = formData.get("payment_method") as string
  const validMethods = ["pix", "boleto", "credit_card"] as const
  const method = validMethods.includes(paymentMethod as typeof validMethods[number])
    ? (paymentMethod as typeof validMethods[number])
    : ("pix" as const)

  const input = {
    patient_id: formData.get("patient_id") as string,
    payment_method: method,
    monthly_value: Number(formData.get("monthly_value")),
    billing_day: Number(formData.get("billing_day")),
    sessions_per_cycle: Number(formData.get("sessions_per_cycle")),
  }

  return createSubscription(input)
}

export function SubscriptionForm({ patients }: SubscriptionFormProps) {
  const router = useRouter()
  const [state, action, pending] = useActionState(formAction, null)

  useEffect(() => {
    if (state?.success && state.data?.error) {
      toast.error(state.data.error)
    } else if (state?.success && state.data?.subscriptionId) {
      toast.success("Assinatura criada com sucesso.")
      router.push("/financeiro/assinaturas")
    } else if (state && !state.success) {
      toast.error(state.error)
    }
  }, [state, router])

  return (
    <form action={action} className="space-y-6">
      {/* Patient */}
      <div className="space-y-2">
        <Label htmlFor="patient_id">Paciente *</Label>
        <select
          id="patient_id"
          name="patient_id"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Selecione o paciente</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Payment method */}
      <div className="space-y-2">
        <Label>Forma de pagamento *</Label>
        <div className="flex gap-4">
          {[
            { value: "pix", label: "PIX" },
            { value: "boleto", label: "Boleto" },
            { value: "credit_card", label: "Cartao" },
          ].map((method) => (
            <label
              key={method.value}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="payment_method"
                value={method.value}
                defaultChecked={method.value === "pix"}
                className="h-4 w-4 accent-primary"
              />
              {method.label}
            </label>
          ))}
        </div>
      </div>

      {/* Monthly value */}
      <div className="space-y-2">
        <Label htmlFor="monthly_value">Valor mensal *</Label>
        <Input
          id="monthly_value"
          name="monthly_value"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="800.00"
          required
        />
      </div>

      {/* Billing day */}
      <div className="space-y-2">
        <Label htmlFor="billing_day">Dia de vencimento *</Label>
        <Input
          id="billing_day"
          name="billing_day"
          type="number"
          min="1"
          max="28"
          placeholder="10"
          required
        />
        <p className="text-xs text-muted-foreground">
          Dia do mes para gerar a cobranca (1 a 28)
        </p>
      </div>

      {/* Sessions per cycle */}
      <div className="space-y-2">
        <Label htmlFor="sessions_per_cycle">Sessoes por ciclo *</Label>
        <Input
          id="sessions_per_cycle"
          name="sessions_per_cycle"
          type="number"
          min="1"
          placeholder="4"
          required
        />
        <p className="text-xs text-muted-foreground">
          Quantidade de sessoes incluidas no pacote mensal
        </p>
      </div>

      {/* Error */}
      {state && !state.success && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {/* Submit */}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando assinatura..." : "Criar assinatura"}
      </Button>
    </form>
  )
}
