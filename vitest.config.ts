import { defineConfig } from "vitest/config"
import path from "path"

// Test-only keys — deterministic, obviously fake, never from credentials.
// 32 bytes each, valid base64, no relation to production keys.
const TEST_KEK = Buffer.alloc(32, 0xaa).toString("base64")
const TEST_CPF_KEY = Buffer.alloc(32, 0xbb).toString("base64")

export default defineConfig({
  test: {
    environment: "node",
    env: {
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
      "server-only": path.resolve(__dirname, "./src/__tests__/stubs/server-only.ts"),
    },
  },
})
