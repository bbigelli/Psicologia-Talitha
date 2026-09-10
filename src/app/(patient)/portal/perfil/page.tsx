import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { PatientProfile } from "@/components/patients/PatientProfile"

export const metadata: Metadata = {
  title: "Perfil",
}

/**
 * Patient profile page.
 *
 * Server component — fetches data with explicit column lists.
 * Displays: patient data (read-only), psychologist info, consent management.
 *
 * @see wireframe B.10
 * @see architecture.md §16 rule 18 (no select(*))
 */
export default async function PerfilPacientePage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Get patient record (explicit columns — never select(*))
  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, email, phone, date_of_birth, psychologist_id")
    .eq("user_id", user.id)
    .single()

  if (!patient) {
    redirect("/login")
  }

  // Get psychologist info (no e-Psi — E5)
  const { data: psychologist } = await supabase
    .from("profiles")
    .select("full_name, crp, specialty")
    .eq("id", patient.psychologist_id)
    .single()

  // Get patient consents (ordered by most recent first)
  const { data: consents } = await supabase
    .from("consents")
    .select("purpose, action, consent_version, occurred_at")
    .eq("patient_id", patient.id)
    .order("occurred_at", { ascending: false })

  return (
    <div className="p-4 md:p-6">
      <PatientProfile
        patient={{
          full_name: patient.full_name,
          email: patient.email,
          phone: patient.phone,
          date_of_birth: patient.date_of_birth,
        }}
        psychologist={{
          full_name: psychologist?.full_name || "",
          crp: psychologist?.crp || null,
          specialty: psychologist?.specialty || null,
        }}
        consents={consents || []}
      />
    </div>
  )
}
