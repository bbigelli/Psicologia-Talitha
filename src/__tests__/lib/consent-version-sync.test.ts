/**
 * Consent version synchronization test.
 *
 * Ensures all consumers of CURRENT_CONSENT_VERSION reference the
 * same canonical value from @/lib/consent-version.ts.
 *
 * This test exists because the version was previously inlined as "1.0"
 * in three places (schema, middleware, patient layout). If someone bumps
 * the version in one place but not the others, the middleware and layout
 * would silently accept the old version — reintroducing the W1 bug
 * from Sprint 3 with no test failing.
 *
 * @see W3 from code review Sprint 3
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

const ROOT = resolve(__dirname, "../../..")

/**
 * Read a source file and extract all string values assigned to
 * variables named CURRENT_CONSENT_VERSION or CURRENT_VERSION.
 */
function extractVersionValues(filePath: string): string[] {
  const content = readFileSync(resolve(ROOT, filePath), "utf-8")
  const values: string[] = []

  // Match: export const CURRENT_CONSENT_VERSION = "X.Y"
  // Match: const CURRENT_VERSION = "X.Y"
  // Match: const CURRENT_VERSION = CURRENT_CONSENT_VERSION (re-export — skip)
  const assignmentRe =
    /(?:const|let|var)\s+(?:CURRENT_CONSENT_VERSION|CURRENT_VERSION)\s*=\s*"([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = assignmentRe.exec(content)) !== null) {
    values.push(match[1])
  }

  return values
}

describe("CURRENT_CONSENT_VERSION synchronization (W3)", () => {
  it("canonical module defines exactly one version value", () => {
    const values = extractVersionValues("src/lib/consent-version.ts")
    expect(values).toHaveLength(1)
    expect(values[0]).toBeTruthy()
  })

  it("middleware.ts does NOT define an inline version string", () => {
    const values = extractVersionValues("src/middleware.ts")
    // After W3 fix, middleware imports from consent-version.ts
    // and assigns CURRENT_VERSION = CURRENT_CONSENT_VERSION (no string literal)
    expect(values).toHaveLength(0)
  })

  it("patient layout does NOT define an inline version string", () => {
    const values = extractVersionValues("src/app/(patient)/layout.tsx")
    // After W3 fix, layout imports from consent-version.ts
    expect(values).toHaveLength(0)
  })

  it("schemas/consent.ts re-exports (does not redefine) the version", () => {
    const content = readFileSync(
      resolve(ROOT, "src/schemas/consent.ts"),
      "utf-8",
    )
    // Should contain a re-export, not a standalone definition
    expect(content).toContain('from "@/lib/consent-version"')

    // Should NOT have its own "1.0" or any string literal assignment
    const values = extractVersionValues("src/schemas/consent.ts")
    expect(values).toHaveLength(0)
  })

  it("all consumers resolve to the same runtime value", async () => {
    // Import the canonical value
    const { CURRENT_CONSENT_VERSION: canonical } = await import(
      "@/lib/consent-version"
    )

    // Import from schema (re-export)
    const { CURRENT_CONSENT_VERSION: fromSchema } = await import(
      "@/schemas/consent"
    )

    expect(fromSchema).toBe(canonical)
    expect(typeof canonical).toBe("string")
    expect(canonical.length).toBeGreaterThan(0)
  })
})
