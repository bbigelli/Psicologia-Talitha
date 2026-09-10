"use client"

/**
 * NewSessionForm — create a new session (single or recurring).
 *
 * Selects a patient, day of week, time, duration, and recurrence.
 * For recurring sessions, generates 12 weekly occurrences.
 * Shows conflict warnings for partial creation.
 *
 * @see wireframe A.07
 * @see US-302
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { createSession } from "@/lib/actions/sessions"

interface Patient {
  id: string
  full_name: string
}

interface NewSessionFormProps {
  patients: Patient[]
}

const DAY_NAMES = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terca-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sabado" },
]

interface FormValues {
  patient_id: string
  day_of_week: string
  time: string
  duration_minutes: number
  is_recurring: boolean
  start_date: string
}

export function NewSessionForm({ patients }: NewSessionFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      patient_id: "",
      day_of_week: "",
      time: "",
      duration_minutes: 50,
      is_recurring: false,
      start_date: new Date().toISOString().split("T")[0],
    },
  })

  const isRecurring = watch("is_recurring")

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      const result = await createSession({
        patient_id: data.patient_id,
        day_of_week: parseInt(data.day_of_week, 10),
        time: data.time,
        duration_minutes: data.duration_minutes,
        is_recurring: data.is_recurring,
        start_date: data.start_date,
      })

      if (result.success) {
        const { created, total, conflicts } = result.data
        if (conflicts.length > 0) {
          toast.warning(
            `${created} de ${total} sessoes criadas. ${conflicts.length} conflito(s) detectado(s).`,
            {
              description: conflicts
                .map((c) => `${c.patientName}: ${c.startTime}-${c.endTime}`)
                .join("; "),
              duration: 8000,
            },
          )
        } else {
          toast.success(
            created === 1
              ? "Sessao criada com sucesso."
              : `${created} sessoes criadas com sucesso.`,
          )
        }
        router.push("/agenda")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova sessao</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Patient select */}
          <div className="space-y-2">
            <Label htmlFor="patient_id">Paciente</Label>
            <Select
              onValueChange={(val) => setValue("patient_id", String(val))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.patient_id && (
              <p className="text-sm text-destructive">
                {errors.patient_id.message}
              </p>
            )}
          </div>

          {/* Start date */}
          <div className="space-y-2">
            <Label htmlFor="start_date">Data de inicio</Label>
            <Input
              id="start_date"
              type="date"
              {...register("start_date")}
              min={new Date().toISOString().split("T")[0]}
            />
            {errors.start_date && (
              <p className="text-sm text-destructive">
                {errors.start_date.message}
              </p>
            )}
          </div>

          {/* Day of week */}
          <div className="space-y-2">
            <Label htmlFor="day_of_week">Dia da semana</Label>
            <Select
              onValueChange={(val) => setValue("day_of_week", String(val))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o dia" />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.day_of_week && (
              <p className="text-sm text-destructive">
                {errors.day_of_week.message}
              </p>
            )}
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="time">Horario de inicio</Label>
            <Input
              id="time"
              type="time"
              {...register("time")}
            />
            {errors.time && (
              <p className="text-sm text-destructive">
                {errors.time.message}
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration_minutes">
              Duracao (minutos)
            </Label>
            <Input
              id="duration_minutes"
              type="number"
              {...register("duration_minutes", { valueAsNumber: true })}
              min={15}
              max={180}
            />
            {errors.duration_minutes && (
              <p className="text-sm text-destructive">
                {errors.duration_minutes.message}
              </p>
            )}
          </div>

          {/* Recurrence */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_recurring"
              checked={isRecurring}
              onCheckedChange={(checked) =>
                setValue("is_recurring", checked === true)
              }
            />
            <Label htmlFor="is_recurring" className="cursor-pointer">
              Recorrencia semanal (12 semanas)
            </Label>
          </div>

          {isRecurring && (
            <p className="text-sm text-muted-foreground">
              Serao criadas 12 sessoes semanais a partir da data de inicio.
              Horarios com conflito serao ignorados e voce sera notificada.
            </p>
          )}

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Criando..."
                : isRecurring
                  ? "Criar sessoes recorrentes"
                  : "Criar sessao"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
