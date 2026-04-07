import { createClient } from "@/lib/supabase/server"
import { CRON_JOBS } from "@/lib/cron/index"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get last run for each job
  const { data: logs } = await supabase
    .from("cron_logs")
    .select("job_name, status, result_summary, ran_at, duration_ms")
    .order("ran_at", { ascending: false })
    .limit(200)

  // Get enabled settings
  const { data: settings } = await supabase
    .from("settings")
    .select("key, value")
    .like("key", "cron_%_enabled")

  const enabledMap: Record<string, boolean> = {}
  for (const s of settings ?? []) {
    const jobName = s.key.replace("cron_", "").replace("_enabled", "").replace(/_/g, "-")
    enabledMap[jobName] = s.value !== "false"
  }

  // Build status per job
  const jobStatus = Object.entries(CRON_JOBS).map(([name, job]) => {
    const jobLogs = (logs ?? []).filter((l: { job_name: string }) => l.job_name === name)
    const lastRun = jobLogs[0] ?? null
    return {
      name,
      schedule: job.schedule,
      description: job.description,
      enabled: enabledMap[name] ?? true,
      lastRun: lastRun
        ? {
            status: lastRun.status,
            summary: lastRun.result_summary,
            ranAt: lastRun.ran_at,
            durationMs: lastRun.duration_ms,
          }
        : null,
    }
  })

  // Recent logs (last 20)
  const recentLogs = (logs ?? []).slice(0, 20)

  return NextResponse.json({ jobs: jobStatus, recentLogs })
}
