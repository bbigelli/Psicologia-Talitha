import type { Metadata } from "next"
import Link from "next/link"

import { validateInviteToken } from "@/lib/invite"
import { InviteAcceptForm } from "@/components/auth/InviteAcceptForm"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Criar Senha",
  robots: { index: false, follow: false },
}

/**
 * Invite acceptance page — patient creates their password.
 *
 * runtime = nodejs because the action uses node:crypto for token hashing.
 *
 * Headers:
 * - Referrer-Policy: no-referrer (set in middleware for /convite/*)
 * - Cache-Control: no-store (dynamic page, token in URL)
 * - X-Robots-Tag: noindex (set in middleware for authenticated areas)
 *
 * @see wireframe B.01 (Primeiro Acesso)
 * @see architecture.md §8.3 (confirm link rules)
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Validate token without consuming it
  const { status, patientName } = await validateInviteToken(token)

  // Token expired
  if (status === "expired") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <Card className="max-w-md p-6 text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">
            Convite expirado
          </h1>
          <p className="text-muted-foreground">
            Este convite expirou. Entre em contato com sua profissional
            para receber um novo.
          </p>
        </Card>
      </div>
    )
  }

  // Token already used
  if (status === "used") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <Card className="max-w-md p-6 text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">
            Conta ja ativada
          </h1>
          <p className="text-muted-foreground">
            Voce ja ativou sua conta. Faca login normalmente.
          </p>
          <Button render={<Link href="/login" />}>
            Ir para login
          </Button>
        </Card>
      </div>
    )
  }

  // Token invalid
  if (status === "invalid") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <Card className="max-w-md p-6 text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">
            Convite invalido
          </h1>
          <p className="text-muted-foreground">
            Este convite nao e valido. Entre em contato com sua
            profissional para receber um novo.
          </p>
        </Card>
      </div>
    )
  }

  // Token valid — show password creation form
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-foreground">Talitha</h2>
        </div>
        <InviteAcceptForm token={token} patientName={patientName} />
      </div>
    </div>
  )
}
