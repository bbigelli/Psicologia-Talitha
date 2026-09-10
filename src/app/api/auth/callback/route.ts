import { NextResponse, type NextRequest } from "next/server"
import { createMiddlewareClient } from "@/lib/supabase/middleware"

/**
 * Auth callback for PKCE code exchange.
 * Used for password reset links and other Supabase Auth flows.
 *
 * Validates redirect against internal allowlist — never redirect to external URLs.
 */

const ALLOWED_REDIRECTS = [
  "/dashboard",
  "/portal",
  "/onboarding",
  "/mfa/setup",
  "/mfa/verify",
  "/login",
  "/recuperar-senha/nova",
]

function isAllowedRedirect(path: string): boolean {
  return ALLOWED_REDIRECTS.some((allowed) => path.startsWith(allowed))
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  // Validate redirect against allowlist
  const redirectPath = isAllowedRedirect(next) ? next : "/dashboard"

  if (code) {
    const { supabase, response } = createMiddlewareClient(request)
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const redirectUrl = new URL(redirectPath, origin)
      const redirectResponse = NextResponse.redirect(redirectUrl)

      // Copy cookies from the Supabase response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, {
          ...cookie,
        })
      })

      return redirectResponse
    }
  }

  // Code exchange failed — redirect to login
  return NextResponse.redirect(new URL("/login", origin))
}
