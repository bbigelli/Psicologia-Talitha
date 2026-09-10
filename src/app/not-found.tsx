import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <h2 className="text-xl font-semibold text-foreground">
          Pagina nao encontrada
        </h2>
        <p className="text-muted-foreground max-w-md">
          O endereco que voce procura nao existe ou foi movido.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Voltar ao inicio
      </Link>
    </main>
  )
}
