import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * ConsentLayout — minimal layout for consent acceptance pages.
 *
 * Requires patient authentication but no consent check (the user
 * is here precisely to accept consent).
 *
 * @see architecture.md §7.2
 */
export default async function ConsentLayout({
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

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-2xl">{children}</div>
    </main>
  )
}
