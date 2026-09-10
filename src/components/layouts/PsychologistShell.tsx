"use client"

import { useState } from "react"
import { PsychologistSidebar } from "@/components/layouts/PsychologistSidebar"
import { Header } from "@/components/layouts/Header"

/**
 * Client wrapper that manages sidebar state for the psychologist layout.
 * The actual authorization happens in the server layout.
 */
export function PsychologistShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-dvh">
      <PsychologistSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          title="Talitha"
        />
        {children}
      </div>
    </div>
  )
}
