"use client"

import { useRouter } from "next/navigation"
import { LogOut, Menu } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  /** Show hamburger menu button for mobile sidebar toggle */
  onMenuClick?: () => void
  /** Display name */
  title?: string
}

export function Header({ onMenuClick, title = "Talitha" }: HeaderProps) {
  const router = useRouter()

  async function handleLogout() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch {
      toast.error("Erro ao sair. Tente novamente.")
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <span className="text-lg font-bold text-primary">{title}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        aria-label="Sair"
        title="Sair"
      >
        <LogOut className="h-5 w-5" />
      </Button>
    </header>
  )
}
