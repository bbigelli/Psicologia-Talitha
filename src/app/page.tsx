export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold text-foreground">
          Talitha Psicologia
        </h1>
        <p className="text-muted-foreground max-w-md">
          Plataforma integrada para gestao de consultorio de psicologia online.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm text-muted-foreground">
          Sistema em desenvolvimento. Acesso restrito.
        </p>
      </div>
    </main>
  )
}
