import "server-only"

/**
 * Email templates — plain HTML, neutral language.
 *
 * Content policy (architecture.md §8.3, security-review-prd.md):
 * - Subject and preheader NEVER reveal therapy, psychology, clinical data
 * - Subject from approved allowlist only
 * - Body can be more specific (requires opening the email)
 * - No clinical content (D1/D2), no CPF, no values in subject
 * - Links: token in path (never query string), no direct room access
 * - Preheader explicitly defined (prevents client from using first line)
 *
 * Approved subjects:
 * - Invite: "Seu acesso ao portal"
 * - Security: "Atividade na sua conta"
 * - Reminder: "Lembrete de compromisso" (Edge Function send-reminders)
 * - Cancellation: "Atualizacao de compromisso" (notification emails)
 */

/**
 * Invite email — sent when psychologist registers a new patient.
 */
export function buildInviteEmail(params: {
  patientName: string
  inviteUrl: string
  psychologistName: string
}): {
  subject: string
  html: string
  text: string
} {
  const { patientName, inviteUrl, psychologistName } = params

  const subject = "Seu acesso ao portal"

  // Preheader: neutral, no clinical reference
  const preheader = "Voce recebeu um convite para criar sua conta."

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8faf9;font-family:Arial,Helvetica,sans-serif;">
  <!-- Preheader (hidden) -->
  <span style="display:none;font-size:1px;color:#f8faf9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8faf9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;padding:32px;border:1px solid #e2e8f0;">
          <tr>
            <td>
              <h1 style="margin:0 0 8px;font-size:20px;color:#1a1a1a;font-weight:600;">
                Talitha
              </h1>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />

              <p style="margin:0 0 16px;font-size:16px;color:#333333;line-height:1.5;">
                Ola, ${patientName}.
              </p>

              <p style="margin:0 0 16px;font-size:16px;color:#333333;line-height:1.5;">
                ${psychologistName} convidou voce para acessar o portal.
                Clique no botao abaixo para criar sua senha e comecar.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#5B8C7E;border-radius:6px;padding:12px 24px;">
                    <a href="${inviteUrl}" style="color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;display:inline-block;">
                      Criar minha senha
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#666666;line-height:1.5;">
                Este convite expira em 72 horas. Caso expire, entre em contato
                com sua profissional para receber um novo.
              </p>

              <p style="margin:0;font-size:12px;color:#999999;line-height:1.5;">
                Se voce nao reconhece este convite, ignore este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `Ola, ${patientName}.

${psychologistName} convidou voce para acessar o portal.
Acesse o link abaixo para criar sua senha:

${inviteUrl}

Este convite expira em 72 horas.

Se voce nao reconhece este convite, ignore este e-mail.`

  return { subject, html, text }
}
