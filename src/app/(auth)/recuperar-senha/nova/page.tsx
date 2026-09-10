import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ResetPassword } from "@/components/auth/ResetPassword"

export const metadata: Metadata = {
  title: "Nova Senha",
}

export default async function NovaSenhaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Must have a valid session (created by the password reset callback)
  if (!user) {
    redirect("/login")
  }

  // Check if user has TOTP factors — if so, MFA challenge required
  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const hasMfa = (factorsData?.totp?.length ?? 0) > 0

  return <ResetPassword hasMfa={hasMfa} />
}
