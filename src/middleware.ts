/**
 * Middleware — UX + defense-in-depth.
 *
 * NOT the authorization boundary. Layouts and Server Action wrappers
 * are the real boundaries. This middleware can be bypassed (CVE-2025-29927)
 * and does not cover Server Actions.
 *
 * Fail-closed: any error in getUser() redirects to /login.
 *
 * @see architecture.md §7.1, §7.2
 */
import { type NextRequest, NextResponse } from "next/server"
import { createMiddlewareClient } from "@/lib/supabase/middleware"
import { CURRENT_CONSENT_VERSION } from "@/lib/consent-version"

/** Routes that do not require authentication */
const PUBLIC_PATHS = [
  "/login",
  "/recuperar-senha",
  "/convite",
  "/confirmar",
  "/api/auth/callback",
]

/** Routes accessible only by psychologist */
const PSYCHOLOGIST_ONLY = [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/financeiro",
  "/perfil",
  "/onboarding",
]

/** Routes accessible only by patient */
const PATIENT_ONLY = ["/portal", "/termos"]

/** MFA-related routes (accessible at aal1) */
const MFA_PATHS = ["/mfa/setup", "/mfa/verify"]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

function isMfaPath(pathname: string): boolean {
  return MFA_PATHS.some((p) => pathname.startsWith(p))
}

function isPsychologistPath(pathname: string): boolean {
  return PSYCHOLOGIST_ONLY.some((p) => pathname.startsWith(p))
}

function isPatientPath(pathname: string): boolean {
  return PATIENT_ONLY.some((p) => pathname.startsWith(p))
}

/** Security headers added to every response */
function addSecurityHeaders(response: NextResponse, pathname: string): void {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin")
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none")

  // Authenticated areas: noindex
  if (!isPublicPath(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex")
  }

  // Stricter referrer for token pages
  if (
    pathname.startsWith("/confirmar") ||
    pathname.startsWith("/convite")
  ) {
    response.headers.set("Referrer-Policy", "no-referrer")
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Create Supabase middleware client (refreshes cookies)
  const { supabase, response } = createMiddlewareClient(request)

  // Add security headers
  addSecurityHeaders(response, pathname)

  // 2. Public routes — allow
  if (isPublicPath(pathname)) {
    return response
  }

  // 3. Get user — fail-closed on ANY error
  let user
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    user = data.user
  } catch {
    // Fail-closed: any error → login
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // MFA paths are accessible at aal1 (the user needs them to promote to aal2)
  if (isMfaPath(pathname)) {
    return response
  }

  // 4. Get role from profiles (source of truth in DB)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .single()

  if (!profile || !["psychologist", "patient"].includes(profile.role)) {
    // Unknown role — invalidate session and redirect
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // 5. Psychologist flow
  if (profile.role === "psychologist") {
    // Check MFA assurance level — must be aal2
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aal?.currentLevel !== "aal2") {
      // Check if TOTP is enrolled
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasTotp = (factors?.totp?.length ?? 0) > 0

      if (!hasTotp) {
        // No TOTP enrolled — send to setup
        if (!pathname.startsWith("/mfa/setup")) {
          return NextResponse.redirect(
            new URL("/mfa/setup", request.url),
          )
        }
        return response
      }

      // TOTP enrolled but session is aal1 — send to verify
      if (!pathname.startsWith("/mfa/verify")) {
        return NextResponse.redirect(
          new URL("/mfa/verify", request.url),
        )
      }
      return response
    }

    // Psychologist accessing patient routes
    if (isPatientPath(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // Check onboarding
    if (
      !profile.onboarding_completed &&
      !pathname.startsWith("/onboarding")
    ) {
      return NextResponse.redirect(new URL("/onboarding", request.url))
    }

    return response
  }

  // 6. Patient flow
  if (profile.role === "patient") {
    // Psychologist-only routes
    if (isPsychologistPath(pathname)) {
      return NextResponse.redirect(new URL("/portal", request.url))
    }

    // Consent check — patient must accept required consents at CURRENT version
    // Terms routes are always accessible (that's where they accept/re-accept)
    if (!pathname.startsWith("/termos")) {
      // Look up patient record and check for active consents
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (patient) {
        const requiredPurposes = [
          "online_therapy",
          "lgpd_clinical",
          "lgpd_asaas",
        ]

        // Imported from @/lib/consent-version (zero-dependency canonical module).
        // W3 fix: eliminates inline "1.0" that could diverge from schema.
        const CURRENT_VERSION = CURRENT_CONSENT_VERSION

        const { data: consents } = await supabase
          .from("consents")
          .select("purpose, action, consent_version, occurred_at")
          .eq("patient_id", patient.id)
          .in("purpose", requiredPurposes)
          .order("occurred_at", { ascending: false })

        // Get latest record per purpose
        const latestByPurpose = new Map<
          string,
          { action: string; version: string }
        >()
        if (consents) {
          for (const c of consents) {
            if (!latestByPurpose.has(c.purpose)) {
              latestByPurpose.set(c.purpose, {
                action: c.action,
                version: c.consent_version,
              })
            }
          }
        }

        // All required: latest action = 'accept' AND version = current
        const allAccepted = requiredPurposes.every((p) => {
          const latest = latestByPurpose.get(p)
          return (
            latest?.action === "accept" &&
            latest?.version === CURRENT_VERSION
          )
        })

        if (!allAccepted) {
          return NextResponse.redirect(
            new URL("/termos/atendimento", request.url),
          )
        }
      }
    }

    return response
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     * - public files (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
