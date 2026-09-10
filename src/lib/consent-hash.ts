import "server-only"

/**
 * Server-only consent text hash computation.
 *
 * Used to verify that CONSENT_HASHES in consent-texts.ts match
 * the actual text content. This module uses node:crypto and
 * cannot be imported from client components.
 *
 * @see consent-texts.ts for the text constants and precomputed hashes
 */

import { createHash } from "node:crypto"

/**
 * Compute SHA-256 hash of consent text for versioning.
 */
export function hashConsentText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex")
}
