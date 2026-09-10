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

  // Defense-in-depth: verify consent status at current version.
  // Keep CURRENT_VERSION in sync with @/schemas/consent.ts.
  const CURRENT_VERSION = "1.0"

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (patient) {
    const requiredPurposes = ["online_therapy", "lgpd_clinical", "lgpd_asaas"]

    const { data: consents } = await supabase
      .from("consents")
      .select("purpose, action, consent_version, occurred_at")
      .eq("patient_id", patient.id)
      .in("purpose", requiredPurposes)
      .order("occurred_at", { ascending: false })

    const latestByPurpose = new Map<
      string,
      { action: string; version: string }
    >()
    if (consents) {
      for (const c of consents) {
        if (!latestByPurpose.has(c.purpose)) {
          latestByPurpose.set(c.purpose, {
            action: c.action,
            version: c.consent_version,
          })
        }
      }
    }

    const allAccepted = requiredPurposes.every((p) => {
      const latest = latestByPurpose.get(p)
      return (
        latest?.action === "accept" &&
        latest?.version === CURRENT_VERSION
      )
    })

    if (!allAccepted) {
      redirect("/termos/atendimento")
    }
  }

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
