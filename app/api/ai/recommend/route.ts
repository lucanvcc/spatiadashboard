import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET() {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const since = thirtyDaysAgo.toISOString().split("T")[0]

  const [{ data: spend }, { data: revenue }] = await Promise.all([
    supabase.from("marketing_spend").select("*").gte("date", since),
    supabase.from("revenue_events").select("*").gte("date", since),
  ])

  if (!spend?.length) {
    return NextResponse.json({
      recommendation: "No ad spend data yet. Add your first campaign to get AI-powered recommendations.",
    })
  }

  // Aggregate by channel
  const byChannel: Record<string, { spent: number; leads: number; revenue: number }> = {}
  for (const s of spend) {
    if (!byChannel[s.channel]) byChannel[s.channel] = { spent: 0, leads: 0, revenue: 0 }
    byChannel[s.channel].spent += s.amount_spent
    byChannel[s.channel].leads += s.leads_generated ?? 0
  }
  for (const r of revenue ?? []) {
    const ch = r.source === "meta_ad" ? "meta" : r.source === "google_ad" ? "google" : null
    if (ch && byChannel[ch]) byChannel[ch].revenue += r.amount
  }

  const summary = Object.entries(byChannel)
    .map(([ch, d]) => {
      const cpl = d.leads > 0 ? (d.spent / d.leads).toFixed(0) : "N/A"
      const roas = d.spent > 0 ? (d.revenue / d.spent).toFixed(2) : "0"
      return `${ch}: $${d.spent.toFixed(0)} spent, ${d.leads} leads, CPL $${cpl}, ROAS ${roas}x`
    })
    .join("\n")

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `You are a marketing advisor for Spatia, a 3D virtual tour studio in Montreal. Based on this 30-day channel performance data, give ONE specific budget reallocation recommendation in 2 sentences max. Be direct and numbers-specific. Data:\n${summary}`,
      },
    ],
  })

  const recommendation =
    message.content[0].type === "text" ? message.content[0].text : "Unable to generate recommendation."

  return NextResponse.json({ recommendation })
}
