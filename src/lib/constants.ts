/** Application-wide constants */

/** Roles — source of truth is profiles.role in the database */
export const ROLES = {
  PSYCHOLOGIST: "psychologist",
  PATIENT: "patient",
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/** MFA assurance levels */
export const AAL = {
  AAL1: "aal1",
  AAL2: "aal2",
} as const

/** Public routes that do not require authentication */
export const PUBLIC_PATHS = [
  "/login",
  "/recuperar-senha",
  "/convite",
  "/confirmar",
] as const

/** Routes that require psychologist role */
export const PSYCHOLOGIST_PATHS = [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/financeiro",
  "/perfil",
  "/onboarding",
] as const

/** Routes that require patient role */
export const PATIENT_PATHS = ["/portal"] as const
