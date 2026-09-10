import { describe, it, expect } from "vitest"
import { onboardingFormSchema, onboardingSchema } from "@/schemas/profile"

describe("onboardingFormSchema", () => {
  const validInput = {
    full_name: "Dra. Ana Silva",
    crp: "CRP 06/12345",
    cpf: "52998224725", // Valid CPF (check digits pass)
    phone: "11999990001",
    email: "ana@example.com",
    default_session_value: 200,
    cancellation_policy_hours: 24,
  }

  it("accepts valid input", () => {
    const result = onboardingFormSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("rejects short name", () => {
    const result = onboardingFormSchema.safeParse({
      ...validInput,
      full_name: "Ab",
    })
    expect(result.success).toBe(false)
  })

  it("accepts CRP with various formats", () => {
    expect(
      onboardingFormSchema.safeParse({ ...validInput, crp: "CRP 06/12345" })
        .success,
    ).toBe(true)
    expect(
      onboardingFormSchema.safeParse({ ...validInput, crp: "CRP06/12345" })
        .success,
    ).toBe(true)
    expect(
      onboardingFormSchema.safeParse({ ...validInput, crp: "crp 06/1234" })
        .success,
    ).toBe(true)
  })

  it("rejects invalid CRP format", () => {
    expect(
      onboardingFormSchema.safeParse({ ...validInput, crp: "12345" }).success,
    ).toBe(false)
    expect(
      onboardingFormSchema.safeParse({ ...validInput, crp: "CRP/12345" })
        .success,
    ).toBe(false)
  })

  it("rejects CPF with all same digits", () => {
    const result = onboardingFormSchema.safeParse({
      ...validInput,
      cpf: "11111111111",
    })
    expect(result.success).toBe(false)
  })

  it("rejects CPF with invalid check digits", () => {
    const result = onboardingFormSchema.safeParse({
      ...validInput,
      cpf: "12345678901",
    })
    expect(result.success).toBe(false)
  })

  it("accepts CPF with formatting (stripped in validation)", () => {
    const result = onboardingFormSchema.safeParse({
      ...validInput,
      cpf: "529.982.247-25",
    })
    expect(result.success).toBe(true)
  })

  it("rejects negative session value", () => {
    const result = onboardingFormSchema.safeParse({
      ...validInput,
      default_session_value: -10,
    })
    expect(result.success).toBe(false)
  })

  it("rejects zero session value", () => {
    const result = onboardingFormSchema.safeParse({
      ...validInput,
      default_session_value: 0,
    })
    expect(result.success).toBe(false)
  })

  it("specialty is optional", () => {
    // validInput doesn't include specialty — it should still pass
    const result = onboardingFormSchema.safeParse(validInput)
    expect(result.success).toBe(true)

    // Explicitly including specialty also works
    const withSpecialty = { ...validInput, specialty: "Psicologia Clinica" }
    expect(onboardingFormSchema.safeParse(withSpecialty).success).toBe(true)
  })
})

describe("onboardingSchema (server-side with transforms)", () => {
  it("transforms CPF by stripping non-digits", () => {
    const result = onboardingSchema.safeParse({
      full_name: "Dra. Ana Silva",
      crp: "CRP 06/12345",
      cpf: "529.982.247-25",
      phone: "(11) 99999-0001",
      email: "ana@example.com",
      default_session_value: 200,
      cancellation_policy_hours: 24,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cpf).toBe("52998224725")
      expect(result.data.phone).toBe("11999990001")
    }
  })

  it("applies default cancellation_policy_hours", () => {
    const result = onboardingSchema.safeParse({
      full_name: "Dra. Ana Silva",
      crp: "CRP 06/12345",
      cpf: "52998224725",
      phone: "11999990001",
      email: "ana@example.com",
      default_session_value: 200,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cancellation_policy_hours).toBe(24)
    }
  })
})

describe("e-Psi field (Emenda E5)", () => {
  it("schema does NOT have epsi_status field", () => {
    // Emenda E5: e-Psi was deactivated 2024-08-31
    // The schema must NOT include any e-Psi related field
    const shape = onboardingFormSchema.shape
    expect("epsi_status" in shape).toBe(false)
    expect("epsi" in shape).toBe(false)
  })
})
