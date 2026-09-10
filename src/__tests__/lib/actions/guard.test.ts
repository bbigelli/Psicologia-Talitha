/**
 * Authorization guards — fail-closed behavior tests.
 *
 * Verifies that withPsychologist, withPatient, and withPublicAction
 * DENY access when auth context is missing or invalid. These are the
 * TRUE authorization boundary (architecture.md §5.1, ADR-0006).
 *
 * Mock strategy:
 * - @/lib/supabase/server is fully mocked (avoids next/headers dependency)
 * - @/lib/logger is mocked to suppress console output
 * - Each test configures createClient mock before calling the guard
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Supabase server client — prevents next/headers import
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

// Mock logger — suppresses console output during tests
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import {
  withPsychologist,
  withPatient,
  withPublicAction,
} from "@/lib/actions/_guard"

const mockCreateClient = vi.mocked(createClient)

describe("withPsychologist — fail-closed authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should deny access when user is not authenticated", async () => {
    // Arrange — getUser returns no user
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("not authenticated"),
        }),
      },
    } as never)

    const inner = vi.fn()
    const action = withPsychologist(inner)

    // Act
    const result = await action(undefined)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Nao autenticado")
    }
    expect(inner).not.toHaveBeenCalled()
  })

  it("should deny access when user has patient role (wrong role)", async () => {
    // Arrange — getUser succeeds but role is patient
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "user-123", role: "patient" },
              error: null,
            }),
          }),
        }),
      }),
    } as never)

    const inner = vi.fn()
    const action = withPsychologist(inner)
    const result = await action(undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Sem permissao")
    }
    expect(inner).not.toHaveBeenCalled()
  })

  it("should deny access when MFA level is aal1 (not aal2)", async () => {
    // Arrange — correct role but only aal1 (password-only session)
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentLevel: "aal1" },
          }),
        },
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "user-123", role: "psychologist" },
              error: null,
            }),
          }),
        }),
      }),
    } as never)

    const inner = vi.fn()
    const action = withPsychologist(inner)
    const result = await action(undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("MFA obrigatorio")
    }
    expect(inner).not.toHaveBeenCalled()
  })

  it("should deny access when profile lookup fails", async () => {
    // Arrange — getUser succeeds but profile query returns error
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("profile not found"),
            }),
          }),
        }),
      }),
    } as never)

    const inner = vi.fn()
    const action = withPsychologist(inner)
    const result = await action(undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Sem permissao")
    }
    expect(inner).not.toHaveBeenCalled()
  })
})

describe("withPatient — fail-closed authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should deny access when user is not authenticated", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("not authenticated"),
        }),
      },
    } as never)

    const inner = vi.fn()
    const action = withPatient(inner)
    const result = await action(undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Nao autenticado")
    }
    expect(inner).not.toHaveBeenCalled()
  })

  it("should deny access when user has psychologist role", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "user-123", role: "psychologist" },
              error: null,
            }),
          }),
        }),
      }),
    } as never)

    const inner = vi.fn()
    const action = withPatient(inner)
    const result = await action(undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Sem permissao")
    }
    expect(inner).not.toHaveBeenCalled()
  })
})

describe("withPublicAction — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return error when inner function throws", async () => {
    mockCreateClient.mockResolvedValue({} as never)

    const action = withPublicAction(async () => {
      throw new Error("simulated failure")
    })
    const result = await action(undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Erro interno do servidor")
    }
  })

  it("should return generic error message, never the exception details", async () => {
    mockCreateClient.mockResolvedValue({} as never)

    const action = withPublicAction(async () => {
      throw new Error("SELECT * FROM patients WHERE cpf = '12345678901'")
    })
    const result = await action(undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      // Must be generic — no SQL, no CPF, no table names
      expect(result.error).toBe("Erro interno do servidor")
      expect(result.error).not.toContain("SELECT")
      expect(result.error).not.toContain("patients")
      expect(result.error).not.toContain("12345678901")
    }
  })
})
