import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Autenticacao",
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-primary">Talitha</h1>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
