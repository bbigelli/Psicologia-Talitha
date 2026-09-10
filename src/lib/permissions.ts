/**
 * Permission checking utilities.
 *
 * Role is always derived from profiles.role in the database (source of truth),
 * never from JWT claims alone.
 *
 * @see architecture.md §7.5
 */

import type { Role } from "./constants"
import { ROLES } from "./constants"

export function isPsychologist(role: string | undefined | null): role is "psychologist" {
  return role === ROLES.PSYCHOLOGIST
}

export function isPatient(role: string | undefined | null): role is "patient" {
  return role === ROLES.PATIENT
}

export function isValidRole(role: string | undefined | null): role is Role {
  return isPsychologist(role) || isPatient(role)
}
