import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET /api/analytics?days=30 — recent analytics_daily rows
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get("days") ?? "30", 10)
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from("analytics_daily")
    .select("*")
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/analytics — upsert a daily analytics entry (for manual Instagram/website metrics)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const date = body.date ?? new Date().toISOString().slice(0, 10)
  const allowed = ["instagram_followers", "website_visits", "instagram_engagement"]
  const updates: Record<string, unknown> = { date }

  for (const key of allowed) {
    if (key in body && body[key] !== "") {
      updates[key] = Number(body[key])
    }
  }

  const { data, error } = await supabase
    .from("analytics_daily")
    .upsert(updates, { onConflict: "date" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
