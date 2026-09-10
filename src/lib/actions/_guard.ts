/**
 * Authorization wrappers for Server Actions.
 *
 * Every exported Server Action MUST use one of these wrappers.
 * They are the TRUE authorization boundary — middleware and layout guards
 * are UX + defense-in-depth only.
 *
 * Gate: `grep -L "withPsychologist\|withPatient\|withPublicAction" src/lib/actions/*.ts`
 * must return empty.
 *
 * Rules:
 * - Always getUser(), never getSession()
 * - Never accept patient_id, psychologist_id, or role as parameter
 * - Derive everything from getUser()
 *
 * @see architecture.md §5.1, §7.2, §18 requirement 1
 * @see ADR-0006
 */

import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import type { ActionResult } from "@/types/actions"

/** Context passed to psychologist-only actions */
export interface PsychologistContext {
  user: User
  supabase: SupabaseClient
  profileId: string
}

/** Context passed to patient-only actions */
export interface PatientContext {
  user: User
  supabase: SupabaseClient
  patientId: string
}

/**
 * Wrap a Server Action that requires psychologist role + aal2.
 *
 * Checks:
 * 1. getUser() succeeds (fail-closed)
 * 2. profiles.role = 'psychologist' (source of truth in DB)
 * 3. MFA assurance level = aal2
 */
export function withPsychologist<TInput, TOutput>(
  fn: (ctx: PsychologistContext, input: TInput) => Promise<TOutput>,
) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return { success: false, error: "Nao autenticado" }
      }

      // Check role from database (source of truth)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single()

      if (profileError || !profile || profile.role !== "psychologist") {
        logError({
          event_type: "authorization_failure",
          user_id: user.id,
          action: "withPsychologist",
          error_code: "WRONG_ROLE",
        })
        return { success: false, error: "Sem permissao" }
      }

      // Check MFA assurance level
      const {
        data: aal,
      } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      if (aal?.currentLevel !== "aal2") {
        return { success: false, error: "MFA obrigatorio" }
      }

      const result = await fn(
        { user, supabase, profileId: profile.id },
        input,
      )
      return { success: true, data: result }
    } catch {
      logError({
        event_type: "action_error",
        action: "withPsychologist",
        error_code: "INTERNAL_ERROR",
      })
      return { success: false, error: "Erro interno do servidor" }
    }
  }
}

/**
 * Wrap a Server Action that requires patient role.
 *
 * Checks:
 * 1. getUser() succeeds (fail-closed)
 * 2. profiles.role = 'patient'
 */
export function withPatient<TInput, TOutput>(
  fn: (ctx: PatientContext, input: TInput) => Promise<TOutput>,
) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return { success: false, error: "Nao autenticado" }
      }

      // Check role from database
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single()

      if (profileError || !profile || profile.role !== "patient") {
        logError({
          event_type: "authorization_failure",
          user_id: user.id,
          action: "withPatient",
          error_code: "WRONG_ROLE",
        })
        return { success: false, error: "Sem permissao" }
      }

      // Derive patient_id from the user — never accept as parameter
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (!patient) {
        return { success: false, error: "Paciente nao encontrado" }
      }

      const result = await fn(
        { user, supabase, patientId: patient.id },
        input,
      )
      return { success: true, data: result }
    } catch {
      logError({
        event_type: "action_error",
        action: "withPatient",
        error_code: "INTERNAL_ERROR",
      })
      return { success: false, error: "Erro interno do servidor" }
    }
  }
}

/**
 * Wrap a public Server Action (no auth required).
 * Still validates CSRF via origin check (Next.js handles via allowedOrigins).
 *
 * Use for: consent confirmation via email token, etc.
 */
export function withPublicAction<TInput, TOutput>(
  fn: (supabase: SupabaseClient, input: TInput) => Promise<TOutput>,
) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    try {
      const supabase = await createClient()
      const result = await fn(supabase, input)
      return { success: true, data: result }
    } catch {
      logError({
        event_type: "action_error",
        action: "withPublicAction",
        error_code: "INTERNAL_ERROR",
      })
      return { success: false, error: "Erro interno do servidor" }
    }
  }
}
