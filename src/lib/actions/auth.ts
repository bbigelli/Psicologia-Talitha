"use server"

import { createHash } from "node:crypto"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logError, logInfo } from "@/lib/logger"
import type { ActionResult } from "@/types/actions"

/**
 * Server-side password reset with aal2 enforcement.
 *
 * This action does NOT use withPsychologist/withPatient because it
 * serves both roles. It performs its own auth verification:
 * 1. getUser() — fail-closed
 * 2. If TOTP factors exist → require aal2 (server-side enforcement)
 * 3. If no TOTP factors → allow (patient without MFA in MVP)
 *
 * The aal2 check is the authorization boundary — not client-side UI state.
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

/**
 * Accept an invite — consume the token and set the patient's password.
 *
 * This action does NOT use withPublicAction because it requires the admin
 * client (service_role) for token consumption, password setting, and patient
 * status update — none of which are accessible to anon/authenticated.
 * Authorization is based on the cryptographic token itself (bearer token model).
 *
 * Flow:
 * 1. Hash the raw token
 * 2. Consume via consume_email_token RPC (via admin client)
 * 3. Set password via admin API
 * 4. Activate patient status
 * 5. Sign in the patient
 *
 * Uses admin client because:
 * - consume_email_token requires authenticated or service_role, and
 *   the patient isn't authenticated yet
 * - auth.admin.updateUserById for password set
 * - patients table has no UPDATE GRANT for authenticated
 */
export async function acceptInvite(
  rawToken: string,
  password: string,
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    // Validate password server-side
    if (!password || password.length < 10) {
      return {
        success: false,
        error: "A senha deve ter no minimo 10 caracteres",
      }
    }

    if (!/[a-zA-Z]/.test(password)) {
      return {
        success: false,
        error: "A senha deve conter pelo menos uma letra",
      }
    }

    if (!/[0-9]/.test(password)) {
      return {
        success: false,
        error: "A senha deve conter pelo menos um numero",
      }
    }

    const tokenHash = createHash("sha256").update(rawToken).digest("hex")
    const adminClient = createAdminClient()

    // 1. Consume token via RPC (atomic: validates expiry, single-use, purpose)
    const { data: tokenResult, error: tokenError } = await adminClient.rpc(
      "consume_email_token",
      {
        p_token_hash: tokenHash,
        p_expected_purpose: "invite",
      },
    )

    if (tokenError) {
      const msg = tokenError.message?.toLowerCase() || ""

      if (msg.includes("already used")) {
        return {
          success: false,
          error: "Voce ja ativou sua conta. Faca login normalmente.",
        }
      }
      if (msg.includes("expired")) {
        return {
          success: false,
          error:
            "Este convite expirou. Entre em contato com sua profissional para receber um novo.",
        }
      }
      return {
        success: false,
        error:
          "Convite invalido. Entre em contato com sua profissional.",
      }
    }

    // tokenResult is an array (RETURNS TABLE); take first row
    const consumed = Array.isArray(tokenResult)
      ? tokenResult[0]
      : tokenResult

    if (!consumed?.patient_id) {
      return {
        success: false,
        error: "Convite invalido.",
      }
    }

    // 2. Get the patient's user_id
    const { data: patient } = await adminClient
      .from("patients")
      .select("user_id")
      .eq("id", consumed.patient_id)
      .single()

    if (!patient?.user_id) {
      return {
        success: false,
        error: "Conta nao encontrada.",
      }
    }

    // 3. Set password via admin API
    const { error: passwordError } =
      await adminClient.auth.admin.updateUserById(patient.user_id, {
        password,
      })

    if (passwordError) {
      logError({
        event_type: "action_error",
        action: "acceptInvite",
        error_code: "PASSWORD_SET_FAILED",
      })
      return {
        success: false,
        error:
          "Nao foi possivel criar a senha. Tente novamente.",
      }
    }

    // 4. Activate patient
    await adminClient
      .from("patients")
      .update({
        status: "active",
        treatment_started_at: new Date().toISOString(),
      })
      .eq("id", consumed.patient_id)

    // 5. Sign the patient in using the server client (sets cookies)
    const supabase = await createClient()
    const { data: signInData } = await adminClient
      .from("patients")
      .select("email:email")
      .eq("id", consumed.patient_id)
      .single()

    if (signInData?.email) {
      await supabase.auth.signInWithPassword({
        email: signInData.email,
        password,
      })
    }

    logInfo({
      event_type: "invite_accepted",
      patient_id: consumed.patient_id,
      action: "ACCEPT_INVITE",
    })

    return {
      success: true,
      data: { redirectTo: "/termos/atendimento" },
    }
  } catch {
    logError({
      event_type: "action_error",
      action: "acceptInvite",
      error_code: "INTERNAL_ERROR",
    })
    return { success: false, error: "Erro interno do servidor" }
  }
}
