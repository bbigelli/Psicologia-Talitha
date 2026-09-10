import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Financeiro",
}

/**
 * Financeiro layout with sub-navigation tabs.
 *
 * Sub-routes: cobrancas, assinaturas, inadimplentes.
 * The layout provides a consistent header with navigation tabs.
 */
export default function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
