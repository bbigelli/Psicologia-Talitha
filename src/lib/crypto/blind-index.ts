/**
 * Blind index for CPF using HMAC-SHA256.
 *
 * Produces a deterministic, non-reversible index that allows
 * equality searches on encrypted CPF without decrypting.
 *
 * @see architecture.md §9.3
 */
import { createHmac } from "node:crypto"
import { CPF_INDEX_KEY } from "./keys"

/**
 * Compute a blind index (HMAC-SHA256) for a CPF value.
 *
 * @param cpf - Raw CPF string (digits only or formatted)
 * @returns Hex-encoded HMAC digest
 */
export function computeCpfBlindIndex(cpf: string): string {
  return createHmac("sha256", CPF_INDEX_KEY).update(cpf).digest("hex")
}
