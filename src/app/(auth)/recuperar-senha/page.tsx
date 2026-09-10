import type { Metadata } from "next"
import { PasswordRecovery } from "@/components/auth/PasswordRecovery"

export const metadata: Metadata = {
  title: "Recuperar Senha",
}

export default function RecuperarSenhaPage() {
  return <PasswordRecovery />
}
