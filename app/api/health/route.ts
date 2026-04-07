import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Simple health check — no auth required
export async function GET() {
  const checks = {
    status: "ok" as "ok" | "degraded",
    cron_registered: false,
    db_connected: false,
    timestamp: new Date().toISOString(),
  }

  // Check cron registration flag
  const globalForCron = globalThis as unknown as { __cronRegistered?: boolean }
  checks.cron_registered = globalForCron.__cronRegistered === true

  // Check DB connectivity
  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await supabase.from("settings").select("key").limit(1)
    checks.db_connected = !error
  } catch {
    checks.db_connected = false
  }

  if (!checks.db_connected) {
    checks.status = "degraded"
  }

  return NextResponse.json(checks, {
    status: checks.status === "ok" ? 200 : 503,
  })
}
