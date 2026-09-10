import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * Root page — redirects based on authentication status.
 * Unauthenticated: → /login
 * Psychologist: → /dashboard (middleware handles MFA/onboarding gates)
 * Patient: → /portal
 */
export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role === "patient") {
    redirect("/portal")
  }

  // Default: psychologist or unknown → middleware handles further
  redirect("/dashboard")
}
