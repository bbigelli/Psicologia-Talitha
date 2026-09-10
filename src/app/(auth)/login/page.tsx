import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LoginForm } from "@/components/auth/LoginForm"

export const metadata: Metadata = {
  title: "Login",
}

export default async function LoginPage() {
  // If already authenticated, redirect away from login
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // Let middleware handle the exact redirect based on role/MFA/onboarding
    redirect("/dashboard")
  }

  return <LoginForm />
}
