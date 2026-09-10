"use client"

/**
 * Charge creation form.
 *
 * Inputs: patient (select), payment method (radio), amount, due date, description.
 * Uses useActionState for Server Action integration.
 * Description note: Asaas description is always neutral ("Prestacao de servicos
 * profissionais — Ref. MM/AAAA"), regardless of what the user types here.
 *
 * @see wireframe A.13
 * @see US-102
 */

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createCharge } from "@/lib/actions/charges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ActionResult } from "@/types/actions"

interface Patient {
  id: string
  full_name: string
}

interface ChargeFormProps {
  patients: Patient[]
  defaultAmount?: number
}

type ChargeResult = { chargeId: string | null; error: string | null }

async function formAction(
  _prev: ActionResult<ChargeResult> | null,
  formData: FormData,
): Promise<ActionResult<ChargeResult>> {
  const paymentMethod = formData.get("payment_method") as string
  const validMethods = ["pix", "boleto", "credit_card"] as const
  const method = validMethods.includes(paymentMethod as typeof validMethods[number])
    ? (paymentMethod as typeof validMethods[number])
    : ("pix" as const)

  const input = {
    patient_id: formData.get("patient_id") as string,
    payment_method: method,
    amount: Number(formData.get("amount")),
    due_date: formData.get("due_date") as string,
    description: (formData.get("description") as string) || undefined,
    session_id: (formData.get("session_id") as string) || undefined,
  }

  return createCharge(input)
}

export function ChargeForm({ patients, defaultAmount }: ChargeFormProps) {
  const router = useRouter()
  const [state, action, pending] = useActionState(formAction, null)

  useEffect(() => {
    if (state?.success && state.data?.error) {
      toast.error(state.data.error)
    } else if (state?.success && state.data?.chargeId) {
      toast.success("Cobranca criada com sucesso.")
      router.push("/financeiro/cobrancas")
    } else if (state && !state.success) {
      toast.error(state.error)
    }
  }, [state, router])

  // Default due date: 7 days from now
  const defaultDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]

  return (
    <form action={action} className="space-y-6">
      {/* Patient select */}
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

      {/* Payment method radio */}
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

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Valor *</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="200.00"
          defaultValue={defaultAmount}
          required
        />
      </div>

      {/* Due date */}
      <div className="space-y-2">
        <Label htmlFor="due_date">Data de vencimento *</Label>
        <Input
          id="due_date"
          name="due_date"
          type="date"
          defaultValue={defaultDueDate}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Descricao</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Sessao de Out/2026"
          maxLength={200}
          rows={2}
        />
        <p className="text-xs text-muted-foreground">
          A descricao no pagamento sera neutra: &quot;Prestacao de servicos
          profissionais&quot;
        </p>
      </div>

      {/* Error display */}
      {state && !state.success && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.success && state.data?.error && (
        <p className="text-sm text-destructive">{state.data.error}</p>
      )}

      {/* Submit */}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando cobranca..." : "Gerar cobranca"}
      </Button>
    </form>
  )
}
