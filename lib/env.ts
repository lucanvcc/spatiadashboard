/**
 * lib/env.ts — early validation of required environment variables
 *
 * Called from instrumentation.ts on server start. Throws a descriptive error
 * if any critical variable is missing, instead of surfacing a cryptic runtime
 * failure deep inside a request handler.
 */

const REQUIRED: Array<{ key: string; hint: string }> = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    hint: "Supabase dashboard → Settings → API → Project URL",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    hint: "Supabase dashboard → Settings → API → anon (public) key",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    hint: "Supabase dashboard → Settings → API → service_role key (keep secret)",
  },
]

const WARN_IF_MISSING: Array<{ key: string; hint: string }> = [
  {
    key: "ZOHO_SMTP_USER",
    hint: "Your Zoho Mail address — required for outreach email sending",
  },
  {
    key: "ZOHO_SMTP_PASSWORD",
    hint: "Zoho app-specific password — required for outreach email sending",
  },
]

export function validateEnv(): void {
  const missing = REQUIRED.filter(({ key }) => !process.env[key])

  if (missing.length > 0) {
    const lines = missing
      .map(({ key, hint }) => `  - ${key}\n      → ${hint}`)
      .join("\n")
    throw new Error(
      `[Spatia] Server cannot start — missing required environment variables:\n\n` +
        lines +
        `\n\nCopy .env.local.example to .env.local and fill in the values.\n`
    )
  }

  const warnMissing = WARN_IF_MISSING.filter(({ key }) => !process.env[key])
  if (warnMissing.length > 0) {
    const lines = warnMissing
      .map(({ key, hint }) => `  - ${key}: ${hint}`)
      .join("\n")
    console.warn(
      `[Spatia] Warning — missing optional environment variables (some features will be broken):\n` +
        lines
    )
  }
}
