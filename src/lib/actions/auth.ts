"use server"

import { createClient } from "@/lib/supabase/server"
import { logError, logInfo } from "@/lib/logger"
import type { ActionResult } from "@/types/actions"

/**
 * Server-side password reset with aal2 enforcement.
 *
 * If the user has TOTP factors, the session MUST be aal2 before the
 * password can be changed. This prevents client-side MFA bypass.
 *
 * After password change, ALL sessions are revoked (global signout).
 *
 * @see architecture.md §7.3
 * @see CLAUDE.md: "Recuperacao de senha exige MFA challenge antes de efetivar"
 */
export async function resetPassword(
  newPassword: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // 1. Verify user is authenticated — fail-closed
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: "Nao autenticado" }
    }

    // 2. If user has TOTP factors, require aal2
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const hasTotp = (factors?.totp?.length ?? 0) > 0

    if (hasTotp) {
      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      if (aal?.currentLevel !== "aal2") {
        logError({
          event_type: "authorization_failure",
          user_id: user.id,
          action: "resetPassword",
          error_code: "MFA_REQUIRED",
        })
        return { success: false, error: "Verificacao MFA obrigatoria" }
      }
    }

    // 3. Validate password length server-side
    if (!newPassword || newPassword.length < 10) {
      return {
        success: false,
        error: "A senha deve ter no minimo 10 caracteres",
      }
    }

    // 4. Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      logError({
        event_type: "action_error",
        user_id: user.id,
        action: "resetPassword",
        error_code: "UPDATE_FAILED",
      })
      return {
        success: false,
        error: "Nao foi possivel alterar a senha. Tente novamente.",
      }
    }

    logInfo({
      event_type: "password_changed",
      user_id: user.id,
      action: "PASSWORD_CHANGE",
    })

    // 5. Revoke ALL sessions — user must log in fresh
    await supabase.auth.signOut({ scope: "global" })

    return { success: true, data: undefined }
  } catch {
    logError({
      event_type: "action_error",
      action: "resetPassword",
      error_code: "INTERNAL_ERROR",
    })
    return { success: false, error: "Erro interno do servidor" }
  }
}
