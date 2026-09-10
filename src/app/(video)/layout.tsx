import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * VideoLayout — minimal layout for video session pages.
 *
 * Requires authentication. Further authorization (session ownership,
 * time window, consent) is handled by the Edge Function that issues
 * the LiveKit token.
 *
 * @see architecture.md §7.2, navigation-flow.md §2.2
 */
export default async function VideoLayout({
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
    <main className="flex min-h-dvh flex-col bg-background">
      {children}
    </main>
  )
}
