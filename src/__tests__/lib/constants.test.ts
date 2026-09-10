import { describe, it, expect } from "vitest"
import { ROLES, AAL, PUBLIC_PATHS } from "@/lib/constants"
import { isPsychologist, isPatient, isValidRole } from "@/lib/permissions"

describe("constants", () => {
  it("defines psychologist and patient roles", () => {
    expect(ROLES.PSYCHOLOGIST).toBe("psychologist")
    expect(ROLES.PATIENT).toBe("patient")
  })

  it("defines aal1 and aal2", () => {
    expect(AAL.AAL1).toBe("aal1")
    expect(AAL.AAL2).toBe("aal2")
  })

  it("public paths include login and recovery", () => {
    expect(PUBLIC_PATHS).toContain("/login")
    expect(PUBLIC_PATHS).toContain("/recuperar-senha")
  })

  it("public paths include convite and confirmar", () => {
    expect(PUBLIC_PATHS).toContain("/convite")
    expect(PUBLIC_PATHS).toContain("/confirmar")
  })
})

describe("permissions", () => {
  it("isPsychologist returns true for psychologist role", () => {
    expect(isPsychologist("psychologist")).toBe(true)
  })

  it("isPsychologist returns false for patient role", () => {
    expect(isPsychologist("patient")).toBe(false)
  })

  it("isPsychologist returns false for null/undefined", () => {
    expect(isPsychologist(null)).toBe(false)
    expect(isPsychologist(undefined)).toBe(false)
  })

  it("isPatient returns true for patient role", () => {
    expect(isPatient("patient")).toBe(true)
  })

  it("isPatient returns false for psychologist role", () => {
    expect(isPatient("psychologist")).toBe(false)
  })

  it("isValidRole accepts psychologist and patient", () => {
    expect(isValidRole("psychologist")).toBe(true)
    expect(isValidRole("patient")).toBe(true)
  })

  it("isValidRole rejects unknown roles", () => {
    expect(isValidRole("admin")).toBe(false)
    expect(isValidRole("")).toBe(false)
    expect(isValidRole(null)).toBe(false)
  })
})
