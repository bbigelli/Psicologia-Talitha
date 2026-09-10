import type { Metadata } from "next"

import { LgpdConsentForm } from "@/components/consent/LgpdConsentForm"

export const metadata: Metadata = {
  title: "Autorizacao LGPD",
  robots: { index: false, follow: false },
}

/**
 * LGPD Consent page — Step 2 of 2.
 *
 * Segmented consent (security review A4):
 * 1. Clinical data treatment (required)
 * 2. Asaas data sharing (required)
 * 3. Communication preferences (optional)
 *
 * @see wireframe B.03
 */
export default function TermoLgpdPage() {
  return <LgpdConsentForm />
}
