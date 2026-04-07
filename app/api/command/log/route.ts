import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json() as { command?: string; params?: Record<string, unknown> }

  if (!body.command) {
    return NextResponse.json({ error: "command required" }, { status: 400 })
  }

  await supabase.from("command_log").insert({
    command: body.command,
    params: body.params ?? null,
    executed_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
