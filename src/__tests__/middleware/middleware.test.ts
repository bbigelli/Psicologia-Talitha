import { describe, it, expect } from "vitest"

/**
 * Middleware logic tests — verifies the route classification helpers.
 *
 * These test the pure logic extracted from middleware.ts without
 * needing the Next.js request/response infrastructure.
 *
 * Full integration tests (actual HTTP requests through middleware)
 * will be added in Sprint 8 with Playwright.
 */

// Inline the route classification logic from middleware.ts for unit testing
const PUBLIC_PATHS = [
  "/login",
  "/recuperar-senha",
  "/convite",
  "/confirmar",
  "/api/auth/callback",
]

const PSYCHOLOGIST_ONLY = [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/financeiro",
  "/perfil",
  "/onboarding",
]

const PATIENT_ONLY = ["/portal", "/termos"]

const MFA_PATHS = ["/mfa/setup", "/mfa/verify"]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

function isMfaPath(pathname: string): boolean {
  return MFA_PATHS.some((p) => pathname.startsWith(p))
}

function isPsychologistPath(pathname: string): boolean {
  return PSYCHOLOGIST_ONLY.some((p) => pathname.startsWith(p))
}

function isPatientPath(pathname: string): boolean {
  return PATIENT_ONLY.some((p) => pathname.startsWith(p))
}

describe("Middleware route classification", () => {
  describe("isPublicPath", () => {
    it("identifies login as public", () => {
      expect(isPublicPath("/login")).toBe(true)
    })

    it("identifies recuperar-senha as public", () => {
      expect(isPublicPath("/recuperar-senha")).toBe(true)
      expect(isPublicPath("/recuperar-senha/nova")).toBe(true)
    })

    it("identifies convite paths as public", () => {
      expect(isPublicPath("/convite/abc123")).toBe(true)
    })

    it("identifies confirmar paths as public", () => {
      expect(isPublicPath("/confirmar/token")).toBe(true)
    })

    it("identifies auth callback as public", () => {
      expect(isPublicPath("/api/auth/callback")).toBe(true)
    })

    it("dashboard is NOT public", () => {
      expect(isPublicPath("/dashboard")).toBe(false)
    })

    it("portal is NOT public", () => {
      expect(isPublicPath("/portal")).toBe(false)
    })
  })

  describe("isMfaPath", () => {
    it("identifies /mfa/setup", () => {
      expect(isMfaPath("/mfa/setup")).toBe(true)
    })

    it("identifies /mfa/verify", () => {
      expect(isMfaPath("/mfa/verify")).toBe(true)
    })

    it("dashboard is NOT MFA path", () => {
      expect(isMfaPath("/dashboard")).toBe(false)
    })
  })

  describe("isPsychologistPath", () => {
    it("identifies psychologist routes", () => {
      expect(isPsychologistPath("/dashboard")).toBe(true)
      expect(isPsychologistPath("/agenda")).toBe(true)
      expect(isPsychologistPath("/pacientes")).toBe(true)
      expect(isPsychologistPath("/pacientes/123")).toBe(true)
      expect(isPsychologistPath("/financeiro")).toBe(true)
      expect(isPsychologistPath("/perfil")).toBe(true)
      expect(isPsychologistPath("/onboarding")).toBe(true)
    })

    it("portal is NOT psychologist path", () => {
      expect(isPsychologistPath("/portal")).toBe(false)
    })
  })

  describe("isPatientPath", () => {
    it("identifies patient routes", () => {
      expect(isPatientPath("/portal")).toBe(true)
      expect(isPatientPath("/portal/perfil")).toBe(true)
      expect(isPatientPath("/termos")).toBe(true)
      expect(isPatientPath("/termos/atendimento")).toBe(true)
    })

    it("dashboard is NOT patient path", () => {
      expect(isPatientPath("/dashboard")).toBe(false)
    })
  })

  describe("Middleware security rules", () => {
    it("MFA paths are not classified as public", () => {
      expect(isPublicPath("/mfa/setup")).toBe(false)
      expect(isPublicPath("/mfa/verify")).toBe(false)
    })

    it("MFA paths are separate from psychologist paths", () => {
      // MFA paths need aal1 access (authenticated but not yet aal2)
      // They should NOT be in the psychologist-only paths
      expect(isPsychologistPath("/mfa/setup")).toBe(false)
      expect(isPsychologistPath("/mfa/verify")).toBe(false)
    })

    it("API routes are not classified as psychologist or patient paths", () => {
      expect(isPsychologistPath("/api/auth/callback")).toBe(false)
      expect(isPatientPath("/api/auth/callback")).toBe(false)
    })
  })
})

describe("Middleware security invariants", () => {
  it("fail-closed: unknown routes are not public, psychologist, patient, or MFA", () => {
    const unknownRoutes = ["/admin", "/internal", "/secret", "/api/test"]
    for (const route of unknownRoutes) {
      expect(isPublicPath(route)).toBe(false)
      expect(isMfaPath(route)).toBe(false)
      expect(isPsychologistPath(route)).toBe(false)
      expect(isPatientPath(route)).toBe(false)
    }
    // This means the middleware will require auth for unknown routes
  })
})
