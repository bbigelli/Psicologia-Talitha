/**
 * Encryption key loading and validation.
 *
 * Executed at module initialization — fails loudly on boot if keys are
 * missing, malformed, or not exactly 32 bytes. After loading, removes
 * the env var so the key is only accessible through this module.
 *
 * NEVER use `process.env.RECORD_ENCRYPTION_KEK_V1!` directly.
 * NEVER use `process.env.CPF_INDEX_KEY!` directly.
 *
 * @see ADR-0001 — KEK lives in EasyPanel env, never in Supabase
 * @see architecture.md §9.1
 */
import { KEY_LENGTH } from "./constants"

function loadKey(envName: string): Buffer {
  const raw = process.env[envName]
  if (raw === undefined || raw === null || raw === "") {
    throw new Error(
      `Missing ${envName} — server cannot start without encryption keys`,
    )
  }

  let buf: Buffer
  try {
    buf = Buffer.from(raw, "base64")
  } catch {
    throw new Error(`${envName} is not valid base64`)
  }

  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `${envName} must be exactly ${KEY_LENGTH} bytes (got ${buf.length})`,
    )
  }

  // Remove from process.env after loading — key only accessible via this module
  delete process.env[envName]

  return buf
}

/** Master KEK for envelope encryption of clinical records */
export const KEK = loadKey("RECORD_ENCRYPTION_KEK_V1")

/** Key for HMAC-SHA256 blind index of CPF */
export const CPF_INDEX_KEY = loadKey("CPF_INDEX_KEY")
