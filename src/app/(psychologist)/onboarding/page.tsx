import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OnboardingForm } from "@/components/auth/OnboardingForm"

export const metadata: Metadata = {
  title: "Onboarding",
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // If onboarding already completed, go to dashboard
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single()

  if (profile?.onboarding_completed) {
    redirect("/dashboard")
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <OnboardingForm />
      </div>
    </div>
  )
}
