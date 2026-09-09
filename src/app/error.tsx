"use client"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold text-foreground">
          Algo deu errado
        </h1>
        <p className="text-muted-foreground max-w-md">
          Ocorreu um erro inesperado. Tente novamente ou entre em contato com o
          suporte.
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Tentar novamente
      </button>
    </main>
  )
}
