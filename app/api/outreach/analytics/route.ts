import { createAdminClient as createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const since = thirtyDaysAgo.toISOString()

  const [{ data: emails }, { data: campaigns }, { data: contacts }] = await Promise.all([
    supabase
      .from("outreach_emails")
      .select("id, status, sent_at, opened_at, replied_at, campaign_id, subject")
      .gte("created_at", since)
      .not("status", "eq", "rejected"),
    supabase.from("campaigns").select("id, name, stats, status"),
    supabase.from("contacts").select("id, status, created_at"),
  ])

  const allEmails = emails ?? []
  const allCampaigns = campaigns ?? []
  const allContacts = contacts ?? []

  // Build daily time series (last 30 days)
  const dailyMap: Record<string, { date: string; sent: number; opened: number; replied: number }> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split("T")[0]
    dailyMap[key] = { date: key, sent: 0, opened: 0, replied: 0 }
  }

  for (const e of allEmails) {
    if (e.sent_at) {
      const day = e.sent_at.split("T")[0]
      if (dailyMap[day]) dailyMap[day].sent++
    }
    if (e.opened_at) {
      const day = e.opened_at.split("T")[0]
      if (dailyMap[day]) dailyMap[day].opened++
    }
    if (e.replied_at) {
      const day = e.replied_at.split("T")[0]
      if (dailyMap[day]) dailyMap[day].replied++
    }
  }

  const timeSeries = Object.values(dailyMap)

  // Campaign reply rates
  const campaignStats = allCampaigns.map((c) => {
    const cEmails = allEmails.filter((e) => e.campaign_id === c.id && e.sent_at)
    const sent = cEmails.length
    const replied = cEmails.filter((e) => e.replied_at).length
    const opened = cEmails.filter((e) => e.opened_at).length
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      sent,
      opened,
      replied,
      reply_rate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      open_rate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
    }
  }).filter((c) => c.sent > 0)

  // Pipeline funnel
  const stageCounts: Record<string, number> = {}
  for (const c of allContacts) {
    stageCounts[c.status] = (stageCounts[c.status] ?? 0) + 1
  }

  const funnel = [
    { stage: "New Lead", count: stageCounts["new_lead"] ?? 0 },
    { stage: "Researched", count: stageCounts["researched"] ?? 0 },
    { stage: "First Email", count: stageCounts["first_email"] ?? 0 },
    { stage: "Follow-up", count: stageCounts["followup"] ?? 0 },
    { stage: "Replied", count: stageCounts["replied"] ?? 0 },
    { stage: "Meeting", count: stageCounts["meeting"] ?? 0 },
    { stage: "Trial", count: stageCounts["trial"] ?? 0 },
    { stage: "Client", count: stageCounts["client"] ?? 0 },
  ]

  // Overall stats
  const sentEmails = allEmails.filter((e) => e.sent_at)
  const totalSent = sentEmails.length
  const totalOpened = sentEmails.filter((e) => e.opened_at).length
  const totalReplied = sentEmails.filter((e) => e.replied_at).length

  return NextResponse.json({
    timeSeries,
    campaignStats,
    funnel,
    totals: {
      sent: totalSent,
      opened: totalOpened,
      replied: totalReplied,
      open_rate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
      reply_rate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
    },
  })
}
