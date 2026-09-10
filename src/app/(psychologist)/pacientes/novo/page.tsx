import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { PatientForm } from "@/components/patients/PatientForm"

export const metadata: Metadata = {
  title: "Novo Paciente",
}

/**
 * New patient registration page.
 *
 * runtime = nodejs because the server action uses node:crypto
 * for envelope encryption and HMAC.
 */
export const runtime = "nodejs"

export default function NovoPacientePage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/pacientes"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Voltar para pacientes</span>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">
          Novo paciente
        </h1>
      </div>

      <PatientForm />
    </div>
  )
}
