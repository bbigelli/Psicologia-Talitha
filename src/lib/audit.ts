/**
 * Audit logging utilities.
 *
 * Wraps calls to the log_audit and log_audit_system RPCs.
 * Never log clinical content, CPF, tokens, or webhook payloads.
 *
 * @see architecture.md §10
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { logError } from "./logger"

/** Actions registered in the audit log */
export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "CREATE_PATIENT"
  | "UPDATE_PATIENT"
  | "VIEW_RECORD"
  | "CREATE_RECORD"
  | "UPDATE_RECORD"
  | "PURGE_RECORD"
  | "SEARCH_RECORDS"
  | "CREATE_CHARGE"
  | "CANCEL_SESSION"
  | "RESCHEDULE_SESSION"
  | "ACCEPT_CONSENT"
  | "REVOKE_CONSENT"
  | "EXPORT_DATA"
  | "END_TREATMENT"
  | "MFA_SETUP"
  | "MFA_VERIFY"
  | "PASSWORD_CHANGE"

/**
 * Log an audit entry in the context of an authenticated user.
 * Uses the log_audit RPC which derives actor_id from auth.uid().
 */
export async function logAudit(
  supabase: SupabaseClient,
  patientId: string | null,
  action: AuditAction,
  metadata?: Record<string, string | number | boolean>,
): Promise<void> {
  const { error } = await supabase.rpc("log_audit", {
    p_patient_id: patientId,
    p_action: action,
    p_metadata: metadata ? JSON.stringify(metadata) : null,
  })

  if (error) {
    logError({
      event_type: "audit_log_failure",
      action,
      patient_id: patientId ?? undefined,
      error_code: error.code,
    })
  }
}
