import { z } from "zod/v4"

export const loginSchema = z.object({
  email: z.email("E-mail invalido"),
  password: z.string().min(1, "Senha e obrigatoria"),
})

export type LoginInput = z.infer<typeof loginSchema>

export const mfaVerifySchema = z.object({
  code: z
    .string()
    .length(6, "O codigo deve ter 6 digitos")
    .regex(/^\d{6}$/, "O codigo deve conter apenas numeros"),
})

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>

export const recoveryCodeSchema = z.object({
  code: z.string().min(1, "Codigo de recuperacao e obrigatorio"),
})

export type RecoveryCodeInput = z.infer<typeof recoveryCodeSchema>

export const passwordRecoverySchema = z.object({
  email: z.email("E-mail invalido"),
})

export type PasswordRecoveryInput = z.infer<typeof passwordRecoverySchema>

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "A senha deve ter no minimo 10 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao coincidem",
    path: ["confirmPassword"],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
