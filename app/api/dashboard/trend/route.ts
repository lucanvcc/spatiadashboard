import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().split("T")[0]

  const [{ data: revenue }, { data: spend }] = await Promise.all([
    supabase.from("revenue_events").select("date, amount").gte("date", sinceStr),
    supabase.from("marketing_spend").select("date, amount_spent").gte("date", sinceStr),
  ])

  // Build daily map for last 30 days
  const days: Record<string, { revenue: number; spend: number }> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days[d.toISOString().split("T")[0]] = { revenue: 0, spend: 0 }
  }

  for (const r of revenue ?? []) {
    if (days[r.date]) days[r.date].revenue += r.amount
  }
  for (const s of spend ?? []) {
    if (days[s.date]) days[s.date].spend += s.amount_spent
  }

  const data = Object.entries(days).map(([date, vals]) => ({
    date: date.slice(5), // MM-DD
    ...vals,
  }))

  return NextResponse.json(data)
}
