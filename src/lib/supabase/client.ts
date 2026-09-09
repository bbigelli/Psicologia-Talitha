import { createBrowserClient } from "@supabase/ssr"

function getEnvOrThrow(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

const supabaseUrl = getEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL")
const supabaseAnonKey = getEnvOrThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY")

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
