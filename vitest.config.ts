import { defineConfig } from "vitest/config"
import path from "path"
import { readFileSync, existsSync } from "fs"

// Test-only keys — deterministic, obviously fake, never from credentials.
// 32 bytes each, valid base64, no relation to production keys.
const TEST_KEK = Buffer.alloc(32, 0xaa).toString("base64")
const TEST_CPF_KEY = Buffer.alloc(32, 0xbb).toString("base64")

/**
 * Load variables from .env.local for integration tests.
 * - NEXT_PUBLIC_*: publishable keys for anon client tests
 * - SUPABASE_SERVICE_ROLE_KEY: for F3 validation (audit_log write)
 *
 * All loaded from .env.local (git-ignored), never hardcoded.
 */
const ALLOWED_ENV_KEYS = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
])

function loadTestEnvVars(): Record<string, string> {
  const envPath = path.resolve(__dirname, ".env.local")
  if (!existsSync(envPath)) return {}
  const content = readFileSync(envPath, "utf-8")
  const vars: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key.startsWith("NEXT_PUBLIC_") || ALLOWED_ENV_KEYS.has(key)) {
      vars[key] = val
    }
  }
  return vars
}

export default defineConfig({
  test: {
    environment: "node",
    env: {
      ...loadTestEnvVars(),
      // Override crypto keys with deterministic test values — never real keys
      RECORD_ENCRYPTION_KEK_V1: TEST_KEK,
      CPF_INDEX_KEY: TEST_CPF_KEY,
    },
    server: {
      deps: {
        // Mock server-only in test environment — the package throws
        // when imported outside Next.js server context
        inline: ["server-only"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Stub server-only to a no-op in tests
      "server-only": path.resolve(
        __dirname,
        "./src/__tests__/stubs/server-only.ts",
      ),
    },
  },
})
