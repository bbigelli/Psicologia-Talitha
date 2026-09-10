import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MfaVerify } from "@/components/auth/MfaVerify"

export const metadata: Metadata = {
  title: "Verificacao MFA",
}

export default async function MfaVerifyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Must be authenticated (aal1 at minimum)
  if (!user) {
    redirect("/login")
  }

  // If no TOTP factors enrolled, go to setup
  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const hasTotp = (factorsData?.totp?.length ?? 0) > 0

  if (!hasTotp) {
    redirect("/mfa/setup")
  }

  // If already aal2, redirect to appropriate destination
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  if (aal?.currentLevel === "aal2") {
    // Check onboarding status
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("id", user.id)
      .single()

    if (profile?.role === "psychologist") {
      if (!profile.onboarding_completed) {
        redirect("/onboarding")
      }
      redirect("/dashboard")
    }
    if (profile?.role === "patient") {
      redirect("/portal")
    }
    redirect("/dashboard")
  }

  return <MfaVerify />
}
