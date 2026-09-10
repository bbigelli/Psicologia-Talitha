import "server-only"

/**
 * Email sending wrapper.
 *
 * Uses RESEND_API_KEY_APP via getResendClient().
 * Never logs email content, tokens, or recipient details beyond event type.
 *
 * @see architecture.md §8.3
 */
import { getResendClient } from "./client"
import { logError, logInfo } from "@/lib/logger"

/**
 * Default sender. In development without a verified domain,
 * Resend only delivers from onboarding@resend.dev to the
 * account email (or test addresses).
 */
function getEmailFrom(): string {
  return process.env.EMAIL_FROM || "Talitha <onboarding@resend.dev>"
}

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Send an email via Resend.
 *
 * Returns true on success, false on failure.
 * Never throws — caller checks the boolean.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  try {
    const resend = getResendClient()

    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })

    if (error) {
      logError({
        event_type: "email_send_failure",
        action: "sendEmail",
        error_code: "RESEND_ERROR",
      })
      return false
    }

    logInfo({
      event_type: "email_sent",
      action: "sendEmail",
      status: "success",
    })
    return true
  } catch {
    logError({
      event_type: "email_send_failure",
      action: "sendEmail",
      error_code: "SEND_EXCEPTION",
    })
    return false
  }
}
