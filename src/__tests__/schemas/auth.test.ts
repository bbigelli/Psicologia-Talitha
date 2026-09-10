import { describe, it, expect } from "vitest"
import {
  loginSchema,
  mfaVerifySchema,
  recoveryCodeSchema,
  passwordRecoverySchema,
  resetPasswordSchema,
} from "@/schemas/auth"

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "mypassword",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "mypassword",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    })
    expect(result.success).toBe(false)
  })
})

describe("mfaVerifySchema", () => {
  it("accepts valid 6-digit code", () => {
    const result = mfaVerifySchema.safeParse({ code: "123456" })
    expect(result.success).toBe(true)
  })

  it("rejects code with letters", () => {
    const result = mfaVerifySchema.safeParse({ code: "12345a" })
    expect(result.success).toBe(false)
  })

  it("rejects code shorter than 6 digits", () => {
    const result = mfaVerifySchema.safeParse({ code: "12345" })
    expect(result.success).toBe(false)
  })

  it("rejects code longer than 6 digits", () => {
    const result = mfaVerifySchema.safeParse({ code: "1234567" })
    expect(result.success).toBe(false)
  })
})

describe("recoveryCodeSchema", () => {
  it("accepts non-empty code", () => {
    const result = recoveryCodeSchema.safeParse({ code: "XXXX-XXXX-XXXX" })
    expect(result.success).toBe(true)
  })

  it("rejects empty code", () => {
    const result = recoveryCodeSchema.safeParse({ code: "" })
    expect(result.success).toBe(false)
  })
})

describe("passwordRecoverySchema", () => {
  it("accepts valid email", () => {
    const result = passwordRecoverySchema.safeParse({
      email: "user@example.com",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email", () => {
    const result = passwordRecoverySchema.safeParse({
      email: "not-valid",
    })
    expect(result.success).toBe(false)
  })
})

describe("resetPasswordSchema", () => {
  it("accepts matching passwords with 10+ characters", () => {
    const result = resetPasswordSchema.safeParse({
      password: "MySecure10!",
      confirmPassword: "MySecure10!",
    })
    expect(result.success).toBe(true)
  })

  it("rejects password shorter than 10 characters", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short",
      confirmPassword: "short",
    })
    expect(result.success).toBe(false)
  })

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "MySecure10!",
      confirmPassword: "DifferentPass!",
    })
    expect(result.success).toBe(false)
  })
})
