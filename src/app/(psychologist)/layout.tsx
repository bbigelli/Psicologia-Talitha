import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PsychologistShell } from "@/components/layouts/PsychologistShell"
import { SkipToContent } from "@/components/layouts/SkipToContent"

/**
 * PsychologistLayout — guards psychologist routes with re-authorization.
 *
 * Defense-in-depth: layout verifies getUser() + role + aal2 independently
 * of middleware. Middleware is UX, not the authorization boundary.
 *
 * @see architecture.md §7.2
 */
export default async function PsychologistLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Re-authorize: getUser() — fail-closed
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Check role from database (source of truth)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "psychologist") {
    redirect("/login")
  }

  // Check MFA assurance level
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  if (aal?.currentLevel !== "aal2") {
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const hasTotp = (factors?.totp?.length ?? 0) > 0
    redirect(hasTotp ? "/mfa/verify" : "/mfa/setup")
  }

  return (
    <>
      <SkipToContent />
      <PsychologistShell>
        <main id="main-content" className="flex-1 overflow-auto">
          {children}
        </main>
      </PsychologistShell>
    </>
  )
}
