"use client"

/**
 * Shared sub-navigation tabs for the Financeiro section.
 * W10 fix: extracted from 3 duplicated inline components.
 */

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/financeiro/cobrancas", label: "Cobrancas" },
  { href: "/financeiro/assinaturas", label: "Assinaturas" },
  { href: "/financeiro/inadimplentes", label: "Inadimplentes" },
] as const

export function FinanceiroTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b pb-1" aria-label="Financeiro">
      {TABS.map(({ href, label }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
