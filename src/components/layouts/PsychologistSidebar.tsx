"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  UserCircle,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/perfil", label: "Perfil", icon: UserCircle },
] as const

interface PsychologistSidebarProps {
  /** Mobile: controls drawer open state */
  isOpen?: boolean
  /** Mobile: close drawer callback */
  onClose?: () => void
}

export function PsychologistSidebar({
  isOpen,
  onClose,
}: PsychologistSidebarProps) {
  const pathname = usePathname()

  const navContent = (
    <nav className="flex flex-col gap-1 p-4" aria-label="Menu principal">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:bg-sidebar">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-bold text-primary">Talitha</span>
        </div>
        {navContent}
      </aside>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            onClick={onClose}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar shadow-lg lg:hidden">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-lg font-bold text-primary">Talitha</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {navContent}
          </aside>
        </>
      )}
    </>
  )
}
