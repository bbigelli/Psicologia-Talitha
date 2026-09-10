import type { Metadata } from "next"

import { OnlineTherapyConsentForm } from "@/components/consent/OnlineTherapyConsentForm"

export const metadata: Metadata = {
  title: "Termo de Atendimento Online",
  robots: { index: false, follow: false },
}

/**
 * Online Therapy Consent page — Step 1 of 2.
 *
 * CFP term with E7 clauses (online format, faltas, queda de conexao).
 * Patient must accept before proceeding to LGPD consent.
 *
 * @see wireframe B.02
 */
export default function TermoAtendimentoPage() {
  return <OnlineTherapyConsentForm />
}
