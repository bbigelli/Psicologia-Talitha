"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Home,
  Calendar,
  CreditCard,
  FileText,
  UserCircle,
  type LucideIcon,
} from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/portal", label: "Inicio", icon: Home, exact: true },
  { href: "/portal/compromissos", label: "Sessoes", icon: Calendar },
  { href: "/portal/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/portal/documentos", label: "Documentos", icon: FileText },
  { href: "/portal/perfil", label: "Perfil", icon: UserCircle },
]

export function PatientBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-background"
      aria-label="Menu do paciente"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const isActive = exact
          ? pathname === href
          : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
