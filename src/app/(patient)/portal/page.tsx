import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Portal do Paciente",
}

export default function PortalPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground">
        Portal do Paciente
      </h1>
      <p className="mt-2 text-muted-foreground">
        Seus compromissos e informacoes.
      </p>
    </div>
  )
}
