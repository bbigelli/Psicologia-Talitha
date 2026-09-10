import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Painel financeiro em desenvolvimento.
      </p>
    </div>
  )
}
