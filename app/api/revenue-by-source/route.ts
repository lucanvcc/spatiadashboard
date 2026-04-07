import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("revenue_events")
    .select("source, amount")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bySource: Record<string, number> = {}
  for (const r of data ?? []) {
    bySource[r.source] = (bySource[r.source] ?? 0) + r.amount
  }

  return NextResponse.json(
    Object.entries(bySource).map(([source, amount]) => ({ source, amount }))
  )
}
