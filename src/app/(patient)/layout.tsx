import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PatientBottomNav } from "@/components/layouts/PatientBottomNav"
import { Header } from "@/components/layouts/Header"
import { SkipToContent } from "@/components/layouts/SkipToContent"

/**
 * PatientLayout — guards patient routes with re-authorization.
 *
 * Defense-in-depth: layout verifies getUser() + role independently of middleware.
 *
 * @see architecture.md §7.2
 */
export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "patient") {
    redirect("/login")
  }

  // Consent check will be added in Sprint 3
  // For now, allow access to portal

  return (
    <>
      <SkipToContent />
      <div className="flex min-h-dvh flex-col pb-14">
        <Header title="Talitha" />
        <main id="main-content" className="flex-1 overflow-auto">
          {children}
        </main>
        <PatientBottomNav />
      </div>
    </>
  )
}
