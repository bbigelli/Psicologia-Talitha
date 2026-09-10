import type { Metadata } from "next"
import { headers } from "next/headers"
import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { ConfirmAction } from "@/components/auth/ConfirmAction"

export const metadata: Metadata = {
  title: "Confirmar acao | Talitha",
  robots: "noindex, nofollow",
}

export const dynamic = "force-dynamic"

/**
 * /confirmar/[token] — email action confirmation page.
 *
 * Architecture requirement §18.5:
 * - GET only renders — does NOT execute the action
 * - POST (Server Action) executes via consume_email_token RPC
 * - Tokens are separate per action (confirm != cancel)
 * - Cache-Control: no-store, Referrer-Policy: no-referrer
 *
 * Security headers are set by middleware for /confirmar/* routes.
 *
 * @see architecture.md §8.3
 * @see US-305
 */
export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Set security headers
  const headersList = await headers()

  // Validate token WITHOUT consuming it (read-only on GET)
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const admin = createAdminClient()

  const { data: tokenRecord } = await admin
    .from("email_action_tokens")
    .select("id, purpose, session_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (!tokenRecord) {
    return (
      <ConfirmAction
        status="invalid"
        message="Link invalido ou expirado."
      />
    )
  }

  if (tokenRecord.used_at) {
    return (
      <ConfirmAction
        status="used"
        message="Esta acao ja foi processada."
      />
    )
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    return (
      <ConfirmAction
        status="expired"
        message="Este link expirou."
      />
    )
  }

  // Get session info for display (minimal: date and time only, no patient name)
  let sessionInfo: { date: string; time: string } | null = null
  if (tokenRecord.session_id) {
    const { data: session } = await admin
      .from("sessions")
      .select("scheduled_at, duration_minutes")
      .eq("id", tokenRecord.session_id)
      .single()

    if (session) {
      const date = new Date(session.scheduled_at)
      sessionInfo = {
        date: date.toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        time: date.toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
        }),
      }
    }
  }

  const actionLabel =
    tokenRecord.purpose === "confirm_attendance"
      ? "Confirmar presenca"
      : tokenRecord.purpose === "cancel_attendance"
        ? "Cancelar compromisso"
        : "Confirmar"

  return (
    <ConfirmAction
      status="valid"
      token={token}
      purpose={tokenRecord.purpose}
      actionLabel={actionLabel}
      sessionDate={sessionInfo?.date}
      sessionTime={sessionInfo?.time}
    />
  )
}
