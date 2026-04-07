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
  durationMs: number,
  actionItemsCreated: number = 0
) {
  const supabase = getAdminClient()
  await supabase.from("cron_logs").insert({
    job_name: jobName,
    status,
    result_summary: resultSummary,
    ran_at: new Date().toISOString(),
    duration_ms: durationMs,
    action_items_created: actionItemsCreated,
  })
}

export type CronResult = string | { summary: string; actionItemsCreated: number }

export async function runCronJob(name: string, fn: () => Promise<CronResult>): Promise<string> {
  const start = Date.now()
  try {
    const result = await fn()
    const summary = typeof result === "string" ? result : result.summary
    const actionItemsCreated = typeof result === "string" ? 0 : (result.actionItemsCreated ?? 0)
    await logCronRun(name, "success", summary, Date.now() - start, actionItemsCreated)
    console.log(`[cron] ${name} ✓ ${summary}`)
    return summary
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logCronRun(name, "error", message, Date.now() - start, 0)
    console.error(`[cron] ${name} ✗ ${message}`)
    return `ERROR: ${message}`
  }
}

export function getSupabaseAdmin() {
  return getAdminClient()
}
