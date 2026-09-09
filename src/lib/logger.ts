/**
 * Centralized logging module with strict allowlist of serializable keys.
 *
 * This is the ONLY module allowed to call console.log/warn/error/info.
 * Using console.* outside this module is grounds for code review rejection.
 *
 * NEVER log: clinical content, CPF, tokens, webhook payloads, Postgres error
 * objects, Asaas responses, or any secret.
 *
 * @see architecture.md §11.4
 */

/** Keys allowed in structured log entries */
const ALLOWED_KEYS = new Set([
  "event_type",
  "session_id",
  "patient_id",
  "action",
  "status",
  "error_code",
  "user_id",
  "payment_id",
  "message",
  "timestamp",
  "level",
])

interface LogEntry {
  event_type?: string
  session_id?: string
  patient_id?: string
  action?: string
  status?: string
  error_code?: string
  user_id?: string
  payment_id?: string
  message?: string
  [key: string]: unknown
}

function sanitize(entry: LogEntry): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  }

  for (const [key, value] of Object.entries(entry)) {
    if (ALLOWED_KEYS.has(key)) {
      sanitized[key] = value
    }
    // Keys outside the allowlist are silently dropped — never logged
  }

  return sanitized
}

export function logInfo(entry: LogEntry): void {
  const data = sanitize({ ...entry, level: "info" })
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(data))
}

export function logWarn(entry: LogEntry): void {
  const data = sanitize({ ...entry, level: "warn" })
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(data))
}

export function logError(entry: LogEntry): void {
  const data = sanitize({ ...entry, level: "error" })
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(data))
}

/**
 * Extract a safe error code from an error without exposing details.
 * Never log the full error object — only the code.
 */
export function safeErrorCode(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 50)
  }
  return "UNKNOWN_ERROR"
}
