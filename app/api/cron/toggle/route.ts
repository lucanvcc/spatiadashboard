import { createAdminClient as createClient } from "@/lib/supabase/server"
import { CRON_JOBS } from "@/lib/cron/index"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobName, enabled } = await req.json() as { jobName: string; enabled: boolean }

  if (!CRON_JOBS[jobName]) {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 })
  }

  const key = `cron_${jobName.replace(/-/g, "_")}_enabled`
  await supabase.from("settings").upsert({ key, value: String(enabled), updated_at: new Date().toISOString() })

  return NextResponse.json({ ok: true, jobName, enabled })
}
