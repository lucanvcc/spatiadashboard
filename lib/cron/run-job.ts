import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function logCronRun(
  jobName: string,
  status: "success" | "error",
  resultSummary: string,
  durationMs: number
) {
  const supabase = getAdminClient()
  await supabase.from("cron_logs").insert({
    job_name: jobName,
    status,
    result_summary: resultSummary,
    ran_at: new Date().toISOString(),
    duration_ms: durationMs,
  })
}

export async function runCronJob(name: string, fn: () => Promise<string>): Promise<string> {
  const start = Date.now()
  try {
    const summary = await fn()
    await logCronRun(name, "success", summary, Date.now() - start)
    console.log(`[cron] ${name} ✓ ${summary}`)
    return summary
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logCronRun(name, "error", message, Date.now() - start)
    console.error(`[cron] ${name} ✗ ${message}`)
    return `ERROR: ${message}`
  }
}

export function getSupabaseAdmin() {
  return getAdminClient()
}
