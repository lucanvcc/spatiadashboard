import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

export async function GET() {
  const supabase = await createClient()

  const { data: emails } = await supabase
    .from("outreach_emails")
    .select("sent_at, replied_at, status")
    .not("sent_at", "is", null)
    .not("status", "eq", "draft")
    .order("sent_at", { ascending: false })
    .limit(500)

  if (!emails || emails.length === 0) {
    return NextResponse.json({ matrix: null, bestDay: null, bestHour: null, totalSent: 0 })
  }

  // Build day×hour matrix
  const matrix: Record<number, Record<number, { sent: number; replied: number }>> = {}
  for (let d = 0; d < 7; d++) {
    matrix[d] = {}
    for (const h of HOURS) {
      matrix[d][h] = { sent: 0, replied: 0 }
    }
  }

  for (const email of emails) {
    if (!email.sent_at) continue
    const date = new Date(email.sent_at)
    const day = date.getDay()
    const hour = date.getHours()
    if (hour < 6 || hour > 20) continue
    if (!matrix[day]?.[hour]) continue
    matrix[day][hour].sent++
    if (email.status === "replied" || email.replied_at) {
      matrix[day][hour].replied++
    }
  }

  // Best day (minimum 3 emails sent)
  const dayStats = Array.from({ length: 7 }, (_, d) => {
    const sent = HOURS.reduce((s, h) => s + matrix[d][h].sent, 0)
    const replied = HOURS.reduce((s, h) => s + matrix[d][h].replied, 0)
    return { day: d, sent, replied, rate: sent > 0 ? replied / sent : 0 }
  }).filter((s) => s.sent >= 3).sort((a, b) => b.rate - a.rate)

  const bestDay = dayStats[0] ?? null

  // Best hour
  const hourStats = HOURS.map((h) => {
    const sent = Object.values(matrix).reduce((s, dm) => s + (dm[h]?.sent ?? 0), 0)
    const replied = Object.values(matrix).reduce((s, dm) => s + (dm[h]?.replied ?? 0), 0)
    return { hour: h, sent, replied, rate: sent > 0 ? replied / sent : 0 }
  }).filter((s) => s.sent >= 3).sort((a, b) => b.rate - a.rate)

  const bestHour = hourStats[0] ?? null

  const maxRate = Math.max(
    ...Object.values(matrix).flatMap((dm) =>
      Object.values(dm).map((b) => (b.sent >= 2 ? b.replied / b.sent : 0))
    ),
    0.01
  )

  return NextResponse.json({
    matrix,
    bestDay,
    bestHour,
    maxRate,
    totalSent: emails.length,
  })
}
