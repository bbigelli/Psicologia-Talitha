"use server"

/**
 * Email action confirmation Server Action.
 *
 * Handles POST for /confirmar/[token] — executes the action
 * and marks the token as used.
 *
 * Uses withPublicAction because the user may not be authenticated
 * (clicking a link from their email client).
 *
 * The RPC consume_email_token handles:
 * - Expiry validation
 * - Single-use enforcement (used_at in same transaction)
 * - Purpose matching
 *
 * @see architecture.md §8.3, §18 requirement 5
 * @see US-305
 */

import { createHash } from "node:crypto"
import { headers } from "next/headers"
import { z } from "zod/v4"

import { withPublicAction } from "@/lib/actions/_guard"
import { createAdminClient } from "@/lib/supabase/admin"
import { logError, logInfo } from "@/lib/logger"

const confirmActionSchema = z.object({
  token: z.string().min(1, "Token obrigatorio"),
  purpose: z.string().min(1, "Acao invalida"),
})

export const confirmEmailAction = withPublicAction(
  async (_supabase, input: { token: string; purpose: string }) => {
    const parsed = confirmActionSchema.parse(input)

    const tokenHash = createHash("sha256")
      .update(parsed.token)
      .digest("hex")

    const headersList = await headers()
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "0.0.0.0"
    const userAgent = headersList.get("user-agent") || "unknown"

    // Use admin client to call the RPC (email_action_tokens has no RLS policies)
    const admin = createAdminClient()

    const { data: tokenResult, error: consumeError } = await admin.rpc(
      "consume_email_token",
      {
        p_token_hash: tokenHash,
        p_expected_purpose: parsed.purpose,
        p_ip: ip,
        p_user_agent: userAgent,
      },
    )

    if (consumeError) {
      const msg = consumeError.message?.toLowerCase() ?? ""
      if (msg.includes("already used")) {
        throw new Error("Esta acao ja foi processada.")
      }
      if (msg.includes("expired")) {
        throw new Error("Este link expirou.")
      }
      logError({
        event_type: "confirm_action_failure",
        action: "confirmEmailAction",
        error_code: "RPC_FAILED",
      })
      throw new Error("Link invalido ou expirado.")
    }

    // Process the action based on purpose
    const result = Array.isArray(tokenResult)
      ? tokenResult[0]
      : tokenResult

    if (!result) {
      throw new Error("Link invalido ou expirado.")
    }

    if (parsed.purpose === "confirm_attendance" && result.session_id) {
      // Update session status to confirmed via admin (REVOKE prevents authenticated)
      const { error: updateError } = await admin
        .from("sessions")
        .update({ status: "confirmed" })
        .eq("id", result.session_id)
        .in("status", ["scheduled"]) // Only confirm if currently scheduled

      if (updateError) {
        logError({
          event_type: "confirm_attendance_failure",
          session_id: result.session_id,
          action: "CONFIRM_ATTENDANCE",
          error_code: "UPDATE_FAILED",
        })
      }

      // Audit log
      await admin.rpc("log_audit_system", {
        p_actor_id: result.patient_id,
        p_actor_source: "anonymous",
        p_patient_id: result.patient_id,
        p_action: "CONFIRM_ATTENDANCE",
        p_metadata: JSON.stringify({
          session_id: result.session_id,
        }),
      })

      logInfo({
        event_type: "attendance_confirmed",
        session_id: result.session_id,
        action: "CONFIRM_ATTENDANCE",
      })
    } else if (
      parsed.purpose === "cancel_attendance" &&
      result.session_id
    ) {
      // Get cancellation policy for the psychologist
      const { data: session } = await admin
        .from("sessions")
        .select("psychologist_id, scheduled_at, status")
        .eq("id", result.session_id)
        .single()

      if (session && ["scheduled", "confirmed"].includes(session.status)) {
        const { data: profile } = await admin
          .from("profiles")
          .select("cancellation_policy_hours")
          .eq("id", session.psychologist_id)
          .single()

        const policyHours = profile?.cancellation_policy_hours ?? 24
        const sessionTime = new Date(session.scheduled_at)
        const now = new Date()
        const hoursUntilSession =
          (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60)
        const isLateCancellation = hoursUntilSession < policyHours

        // Cancel via admin (the RPC cancel_session requires auth.uid())
        const { error: cancelError } = await admin
          .from("sessions")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: "patient",
            cancellation_reason: isLateCancellation
              ? "[FORA DO PRAZO] Cancelado via email"
              : "Cancelado via email",
          })
          .eq("id", result.session_id)

        if (cancelError) {
          logError({
            event_type: "cancel_attendance_failure",
            session_id: result.session_id,
            action: "CANCEL_ATTENDANCE",
            error_code: "UPDATE_FAILED",
          })
        }

        // Audit log
        await admin.rpc("log_audit_system", {
          p_actor_id: result.patient_id,
          p_actor_source: "anonymous",
          p_patient_id: result.patient_id,
          p_action: "CANCEL_SESSION",
          p_metadata: JSON.stringify({
            session_id: result.session_id,
            via: "email_token",
            late_cancellation: isLateCancellation,
          }),
        })

        logInfo({
          event_type: "attendance_cancelled",
          session_id: result.session_id,
          action: "CANCEL_ATTENDANCE",
        })

        if (isLateCancellation) {
          throw new Error(
            "Compromisso cancelado fora do prazo. Cobranca podera ser devida.",
          )
        }
      } else {
        throw new Error(
          "Este compromisso nao pode mais ser cancelado.",
        )
      }
    }

    return undefined
  },
)
