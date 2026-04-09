import { createAdminClient as createClient } from "@/lib/supabase/server"
import { CRON_JOBS } from "@/lib/cron/index"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobName: string }> }
) {
  const { jobName } = await params

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const job = CRON_JOBS[jobName]
  if (!job) {
    return NextResponse.json(
      { error: `Unknown job: ${jobName}`, available: Object.keys(CRON_JOBS) },
      { status: 404 }
    )
  }

  try {
    const summary = await job.fn()
    return NextResponse.json({ job: jobName, summary })
  } catch (e) {
    return NextResponse.json(
      { error: `Job failed: ${(e as Error).message}` },
      { status: 500 }
    )
  }
}
