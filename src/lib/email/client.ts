import "server-only"

/**
 * Resend email client for user-initiated emails.
 *
 * Uses RESEND_API_KEY_APP (not CRON — that key is for Edge Functions).
 * The client is created lazily on first use.
 *
 * @see architecture.md §8.3
 * @see architecture.md §12.1
 */
import { Resend } from "resend"

let _client: Resend | null = null

export function getResendClient(): Resend {
  if (_client) return _client

  const apiKey = process.env.RESEND_API_KEY_APP
  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY_APP — email sending is unavailable",
    )
  }

  _client = new Resend(apiKey)
  return _client
}
