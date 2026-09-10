import { redirect } from "next/navigation"

/**
 * Financeiro root — redirects to the charges list.
 */
export default function FinanceiroPage() {
  redirect("/financeiro/cobrancas")
}
