import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MfaSetup } from "@/components/auth/MfaSetup"

export const metadata: Metadata = {
  title: "Configurar Autenticacao Segura",
}

export default async function MfaSetupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Must be authenticated (aal1 at minimum)
  if (!user) {
    redirect("/login")
  }

  // If already has TOTP factors, go to verify instead
  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const hasTotp = (factorsData?.totp?.length ?? 0) > 0

  if (hasTotp) {
    redirect("/mfa/verify")
  }

  return <MfaSetup />
}
