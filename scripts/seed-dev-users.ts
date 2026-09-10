/**
 * Development seed script — creates test users in Supabase Auth.
 *
 * Run with: npx tsx scripts/seed-dev-users.ts
 *
 * Creates:
 * 1. Psychologist user (with profile, needs MFA setup manually)
 * 2. Patient test user (adult, >= 18 years old per E1)
 *
 * Credentials are written to docs/credentials.md (git-ignored).
 *
 * SECURITY: This script uses SUPABASE_SERVICE_ROLE_KEY.
 * Never run in production. Never commit the output.
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve } from "path"

// Load env from .env.local
function loadEnv(): Record<string, string> {
  const envPath = resolve(__dirname, "../.env.local")
  if (!existsSync(envPath)) {
    throw new Error(".env.local not found")
  }
  const content = readFileSync(envPath, "utf-8")
  const vars: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx < 0) continue
    vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
  }
  return vars
}

async function main() {
  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local",
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Test credentials — loaded from env or use dev defaults
  const psychologistEmail =
    env.SEED_PSYCHOLOGIST_EMAIL || "psicologa@talitha.dev"
  const psychologistPassword =
    env.SEED_PSYCHOLOGIST_PASSWORD || "SeedDevPassword2026!"
  const patientEmail = env.SEED_PATIENT_EMAIL || "paciente@talitha.dev"
  const patientPassword =
    env.SEED_PATIENT_PASSWORD || "SeedDevPassword2026!"

  // 1. Create psychologist auth user
  // eslint-disable-next-line no-console
  console.info("Creating psychologist user...")
  const { data: psychData, error: psychError } =
    await supabase.auth.admin.createUser({
      email: psychologistEmail,
      password: psychologistPassword,
      email_confirm: true,
      user_metadata: { full_name: "Dra. Ana Silva" },
    })

  if (psychError) {
    if (psychError.message.includes("already been registered")) {
      // eslint-disable-next-line no-console
      console.info("Psychologist user already exists, skipping creation")
    } else {
      throw new Error(`Failed to create psychologist: ${psychError.message}`)
    }
  }

  const psychUserId =
    psychData?.user?.id ??
    (
      await supabase.auth.admin.listUsers()
    ).data?.users?.find((u) => u.email === psychologistEmail)?.id

  if (!psychUserId) {
    throw new Error("Could not find psychologist user ID")
  }

  // Create psychologist profile
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: psychUserId,
      role: "psychologist",
      full_name: "Dra. Ana Silva",
      email: psychologistEmail,
      phone: "11999990001",
      crp: "CRP 06/12345",
      crp_region: "06",
      onboarding_completed: false, // Will be completed via onboarding flow
    },
    { onConflict: "id" },
  )

  if (profileError) {
    // eslint-disable-next-line no-console
    console.error("Profile upsert error:", profileError.code)
  }

  // 2. Create patient auth user (adult — born 2000-01-15, age 26)
  // eslint-disable-next-line no-console
  console.info("Creating patient user...")
  const { data: patientData, error: patientError } =
    await supabase.auth.admin.createUser({
      email: patientEmail,
      password: patientPassword,
      email_confirm: true,
      user_metadata: { full_name: "Maria Oliveira" },
    })

  if (patientError) {
    if (patientError.message.includes("already been registered")) {
      // eslint-disable-next-line no-console
      console.info("Patient user already exists, skipping creation")
    } else {
      throw new Error(`Failed to create patient: ${patientError.message}`)
    }
  }

  const patientUserId =
    patientData?.user?.id ??
    (
      await supabase.auth.admin.listUsers()
    ).data?.users?.find((u) => u.email === patientEmail)?.id

  if (!patientUserId) {
    throw new Error("Could not find patient user ID")
  }

  // Create patient profile
  const { error: patientProfileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: patientUserId,
        role: "patient",
        full_name: "Maria Oliveira",
        email: patientEmail,
        phone: "11999990002",
        onboarding_completed: false,
      },
      { onConflict: "id" },
    )

  if (patientProfileError) {
    // eslint-disable-next-line no-console
    console.error("Patient profile upsert error:", patientProfileError.code)
  }

  // Create patient record
  const { error: patientRecordError } = await supabase
    .from("patients")
    .upsert(
      {
        id: crypto.randomUUID(),
        user_id: patientUserId,
        psychologist_id: psychUserId,
        full_name: "Maria Oliveira",
        email: patientEmail,
        phone: "11999990002",
        date_of_birth: "2000-01-15", // Age 26 — satisfies >= 18 CHECK
        invite_status: "accepted",
      },
      { onConflict: "user_id" },
    )

  if (patientRecordError) {
    // eslint-disable-next-line no-console
    console.error("Patient record error:", patientRecordError.code)
  }

  // 3. Write credentials to docs/credentials.md
  const credentialsContent = `# Credenciais de Desenvolvimento

> **NUNCA commitar este arquivo.** Esta no .gitignore.
> Credenciais sao fictícias, exclusivas para ambiente de desenvolvimento.

## Psicologa

- **Email:** ${psychologistEmail}
- **Senha:** ${psychologistPassword}
- **User ID:** ${psychUserId}
- **Role:** psychologist
- **CRP:** CRP 06/12345
- **MFA:** Configurar no primeiro login via app autenticador

## Paciente de Teste

- **Email:** ${patientEmail}
- **Senha:** ${patientPassword}
- **User ID:** ${patientUserId}
- **Role:** patient
- **Data de nascimento:** 2000-01-15 (26 anos)

## Supabase

- **URL:** Ver .env.local (NEXT_PUBLIC_SUPABASE_URL)
- **Anon Key:** Ver .env.local (NEXT_PUBLIC_SUPABASE_ANON_KEY)
- **Service Role Key:** Ver .env.local (SUPABASE_SERVICE_ROLE_KEY)
`

  const credentialsPath = resolve(__dirname, "../docs/credentials.md")
  writeFileSync(credentialsPath, credentialsContent)
  // eslint-disable-next-line no-console
  console.info("Credentials written to docs/credentials.md")

  // eslint-disable-next-line no-console
  console.info("Seed complete!")
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err.message)
  process.exit(1)
})
