import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "@/components/auth/ProfileForm"

export const metadata: Metadata = {
  title: "Perfil",
}

export default async function PerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch profile data — explicit column list (never select('*'))
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, crp, phone, email, specialty, default_session_value, cancellation_policy_hours",
    )
    .eq("id", user.id)
    .single()

  if (!profile) {
    redirect("/login")
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <ProfileForm
        initialData={{
          full_name: profile.full_name,
          crp: profile.crp ?? "",
          phone: profile.phone ?? "",
          email: profile.email,
          specialty: profile.specialty,
          default_session_value: profile.default_session_value,
          cancellation_policy_hours: profile.cancellation_policy_hours,
        }}
      />
    </div>
  )
}
