/**
 * Envelope encryption using AES-256-GCM.
 *
 * Each record gets its own DEK (Data Encryption Key). The content is
 * encrypted with the DEK, and the DEK is encrypted (wrapped) with the
 * KEK (Key Encryption Key). The AAD (Additional Authenticated Data)
 * ties the ciphertext to its owner, preventing cross-patient swap.
 *
 * @see ADR-0001
 * @see architecture.md §9
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto"

import { KEK } from "./keys"
import {
  AES_ALGORITHM,
  AUTH_TAG_LENGTH,
  CURRENT_KEK_VERSION,
  DEK_LENGTH,
  IV_LENGTH,
} from "./constants"

export interface EncryptedEnvelope {
  /** Encrypted content (hex) */
  contentCiphertext: string
  /** IV used to encrypt content (hex) */
  contentIv: string
  /** GCM auth tag for content (hex) */
  contentTag: string
  /** Wrapped DEK (hex) */
  dekWrapped: string
  /** IV used to wrap DEK (hex) */
  dekIv: string
  /** GCM auth tag for DEK wrapping (hex) */
  dekTag: string
  /** KEK version used for wrapping */
  kekVersion: number
}

/**
 * Build AAD string from identifiers.
 * Format: `ownerId|contextId` — prevents cross-patient ciphertext swap.
 */
function buildAad(ownerId: string, contextId: string): Buffer {
  return Buffer.from(`${ownerId}|${contextId}`, "utf8")
}

/**
 * Encrypt plaintext using envelope encryption.
 *
 * @param plaintext - The data to encrypt
 * @param ownerId - Owner identifier (e.g. patient_id)
 * @param contextId - Context identifier (e.g. record_id or 'cpf')
 * @returns Encrypted envelope with all components needed for storage
 */
export function encrypt(
  plaintext: string,
  ownerId: string,
  contextId: string,
): EncryptedEnvelope {
  const aad = buildAad(ownerId, contextId)

  // Generate a random DEK for this record
  const dek = randomBytes(DEK_LENGTH)

  // Encrypt content with DEK
  const contentIv = randomBytes(IV_LENGTH)
  const contentCipher = createCipheriv(AES_ALGORITHM, dek, contentIv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  contentCipher.setAAD(aad)
  const encrypted = Buffer.concat([
    contentCipher.update(plaintext, "utf8"),
    contentCipher.final(),
  ])
  const contentTag = contentCipher.getAuthTag()

  // Wrap DEK with KEK
  const dekIv = randomBytes(IV_LENGTH)
  const dekCipher = createCipheriv(AES_ALGORITHM, KEK, dekIv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  const wrappedDek = Buffer.concat([
    dekCipher.update(dek),
    dekCipher.final(),
  ])
  const dekTag = dekCipher.getAuthTag()

  return {
    contentCiphertext: encrypted.toString("hex"),
    contentIv: contentIv.toString("hex"),
    contentTag: contentTag.toString("hex"),
    dekWrapped: wrappedDek.toString("hex"),
    dekIv: dekIv.toString("hex"),
    dekTag: dekTag.toString("hex"),
    kekVersion: CURRENT_KEK_VERSION,
  }
}

/**
 * Decrypt an encrypted envelope back to plaintext.
 *
 * @param envelope - The encrypted envelope from storage
 * @param ownerId - Owner identifier (must match the one used during encryption)
 * @param contextId - Context identifier (must match the one used during encryption)
 * @returns Decrypted plaintext
 * @throws If AAD mismatch (wrong patient context), tampered data, or invalid key
 */
export function decrypt(
  envelope: EncryptedEnvelope,
  ownerId: string,
  contextId: string,
): string {
  const aad = buildAad(ownerId, contextId)

  // Unwrap DEK with KEK
  const dekDecipher = createDecipheriv(
    AES_ALGORITHM,
    KEK,
    Buffer.from(envelope.dekIv, "hex"),
    { authTagLength: AUTH_TAG_LENGTH },
  )
  dekDecipher.setAuthTag(Buffer.from(envelope.dekTag, "hex"))
  const dek = Buffer.concat([
    dekDecipher.update(Buffer.from(envelope.dekWrapped, "hex")),
    dekDecipher.final(),
  ])

  // Decrypt content with DEK
  const contentDecipher = createDecipheriv(
    AES_ALGORITHM,
    dek,
    Buffer.from(envelope.contentIv, "hex"),
    { authTagLength: AUTH_TAG_LENGTH },
  )
  contentDecipher.setAAD(aad)
  contentDecipher.setAuthTag(Buffer.from(envelope.contentTag, "hex"))
  const decrypted = Buffer.concat([
    contentDecipher.update(Buffer.from(envelope.contentCiphertext, "hex")),
    contentDecipher.final(),
  ])

  return decrypted.toString("utf8")
}

/**
 * Convert a hex string to Postgres BYTEA literal format.
 *
 * PostgREST expects hex strings with `\x` prefix for BYTEA columns.
 * Without the prefix, PostgREST interprets the hex as ASCII text,
 * doubling the byte count and corrupting the ciphertext. The corruption
 * is silent on write — the error only surfaces on decrypt ("Invalid
 * authentication tag length").
 *
 * This function MUST be used every time an envelope field is written
 * to a BYTEA column via Supabase client (PostgREST).
 */
export function hexToBytea(hex: string): string {
  return `\\x${hex}`
}

/**
 * Convert all envelope fields to BYTEA-safe format for Supabase insert/update.
 *
 * Returns an object with the same field names used by the database columns,
 * ready to spread into an insert/update call.
 */
export function envelopeToBytea(
  envelope: EncryptedEnvelope,
  prefix: string,
): Record<string, string | number> {
  return {
    [`${prefix}_ciphertext`]: hexToBytea(envelope.contentCiphertext),
    [`${prefix}_iv`]: hexToBytea(envelope.contentIv),
    [`${prefix}_tag`]: hexToBytea(envelope.contentTag),
    [`${prefix}_dek_wrapped`]: hexToBytea(envelope.dekWrapped),
    [`${prefix}_dek_iv`]: hexToBytea(envelope.dekIv),
    [`${prefix}_dek_tag`]: hexToBytea(envelope.dekTag),
    [`${prefix}_kek_version`]: envelope.kekVersion,
  }
}
