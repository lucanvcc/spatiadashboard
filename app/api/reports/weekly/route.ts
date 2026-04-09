import { NextRequest, NextResponse } from "next/server"
import { createAdminClient as createClient } from "@/lib/supabase/server"
import { getActiveAlerts } from "@/lib/alerts"

// Parse YYYY-WW into { start, end } date strings (ISO weeks, Mon–Sun)
function parseISOWeek(weekStr: string): { start: string; end: string; weekNum: number; year: number } {
  const match = weekStr.match(/^(\d{4})-(\d{1,2})$/)
  if (!match) throw new Error("Invalid week format. Use YYYY-WW")

  const year = parseInt(match[1], 10)
  const weekNum = parseInt(match[2], 10)

  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7 // Mon=1..Sun=7
  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1) + (weekNum - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  return {
    weekNum,
    year,
    start: weekStart.toISOString().slice(0, 10),
    end: weekEnd.toISOString().slice(0, 10),
  }
}

// Get ISO week string for last completed week (Mon–Sun, fully in the past)
function getLastCompletedWeek(): string {
  const now = new Date()
  // Go back to last Sunday
  const dayOfWeek = now.getUTCDay() || 7
  const lastSun = new Date(now)
  lastSun.setUTCDate(now.getUTCDate() - dayOfWeek)
  // The week containing lastSun — get the Monday of that week
  const mon = new Date(lastSun)
  mon.setUTCDate(lastSun.getUTCDate() - 6)

  // Calculate ISO week number
  const jan4 = new Date(Date.UTC(mon.getUTCFullYear(), 0, 4))
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1))
  const weekNum = Math.round((mon.getTime() - startOfWeek1.getTime()) / 604800000) + 1
  const year = mon.getUTCFullYear()

  return `${year}-${String(weekNum).padStart(2, "0")}`
}

export async function GET(req: NextRequest) {
  const weekParam = req.nextUrl.searchParams.get("week") ?? getLastCompletedWeek()

  let weekRange: ReturnType<typeof parseISOWeek>
  try {
    weekRange = parseISOWeek(weekParam)
  } catch (e) {
    return NextResponse.json({ error: "Invalid week format. Use YYYY-WW" }, { status: 400 })
  }

  const supabase = await createClient()
  const { start, end, weekNum, year } = weekRange

  // Previous week for comparison
  const prevStart = new Date(start)
  prevStart.setUTCDate(prevStart.getUTCDate() - 7)
  const prevEnd = new Date(end)
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 7)
  const prevStartStr = prevStart.toISOString().slice(0, 10)
  const prevEndStr = prevEnd.toISOString().slice(0, 10)

  // ── Pull all data in parallel ──────────────────────────────────────────────
  const [
    { data: weekDays },
    { data: prevWeekDays },
    { data: contacts },
    { data: shoots },
    { data: prevShoots },
    { data: spendRows },
    { data: contentPosts },
    { data: monthRevenue },
    { data: goalSetting },
  ] = await Promise.all([
    // This week analytics_daily rows
    supabase
      .from("analytics_daily")
      .select("date, emails_sent, emails_opened, replies, shoots_booked, revenue, ad_spend")
      .gte("date", start)
      .lte("date", end)
      .order("date"),

    // Previous week analytics_daily rows
    supabase
      .from("analytics_daily")
      .select("date, emails_sent, emails_opened, replies, shoots_booked, revenue, ad_spend")
      .gte("date", prevStartStr)
      .lte("date", prevEndStr)
      .order("date"),

    // Pipeline snapshot — current status of all contacts
    supabase.from("contacts").select("status"),

    // Shoots completed this week
    supabase
      .from("shoots")
      .select("id, status, scheduled_at, delivered_at, total_price")
      .gte("delivered_at", `${start}T00:00:00Z`)
      .lte("delivered_at", `${end}T23:59:59Z`),

    // Shoots completed previous week (for comparison)
    supabase
      .from("shoots")
      .select("id")
      .gte("delivered_at", `${prevStartStr}T00:00:00Z`)
      .lte("delivered_at", `${prevEndStr}T23:59:59Z`),

    // Marketing spend this week by channel
    supabase
      .from("marketing_spend")
      .select("channel, amount_spent, leads_generated")
      .gte("date", start)
      .lte("date", end),

    // Content posted this week
    supabase
      .from("content_calendar")
      .select("pillar, status, engagement_metrics, posted_at")
      .gte("posted_at", `${start}T00:00:00Z`)
      .lte("posted_at", `${end}T23:59:59Z`),

    // Month-to-date revenue (for context)
    supabase
      .from("revenue_events")
      .select("amount")
      .gte("date", `${end.slice(0, 7)}-01`)
      .lte("date", end),

    // Revenue goal setting
    supabase.from("settings").select("value").eq("key", "monthly_revenue_goal").single(),
  ])

  // ── Revenue ──────────────────────────────────────────────────────────────────
  const days = weekDays ?? []
  const prevDays = prevWeekDays ?? []

  const weekRevenue = days.reduce((s, d) => s + (d.revenue ?? 0), 0)
  const prevRevenue = prevDays.reduce((s, d) => s + (d.revenue ?? 0), 0)
  const revVsLastWeekPct =
    prevRevenue > 0 ? Math.round(((weekRevenue - prevRevenue) / prevRevenue) * 100) : null

  const mtdRevenue = (monthRevenue ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const monthGoal = parseInt(goalSetting?.value ?? "3000", 10)
  const goalPct = monthGoal > 0 ? Math.round((mtdRevenue / monthGoal) * 100) : null

  // ── Outreach ─────────────────────────────────────────────────────────────────
  const emailsSent = days.reduce((s, d) => s + (d.emails_sent ?? 0), 0)
  const emailsOpened = days.reduce((s, d) => s + (d.emails_opened ?? 0), 0)
  const emailsReplied = days.reduce((s, d) => s + (d.replies ?? 0), 0)
  const replyRate = emailsSent > 0 ? Math.round((emailsReplied / emailsSent) * 100) : 0

  const prevEmailsSent = prevDays.reduce((s, d) => s + (d.emails_sent ?? 0), 0)
  const prevReplied = prevDays.reduce((s, d) => s + (d.replies ?? 0), 0)
  const prevReplyRate = prevEmailsSent > 0 ? Math.round((prevReplied / prevEmailsSent) * 100) : 0
  const replyRateVsLastWeek = replyRate - prevReplyRate

  // New contacts this week
  const allContacts = contacts ?? []
  const pipeline_snapshot = {
    new_lead: allContacts.filter((c) => c.status === "new_lead").length,
    first_email_sent: allContacts.filter((c) =>
      ["first_email_sent", "followup_sent"].includes(c.status)
    ).length,
    replied: allContacts.filter((c) => ["replied", "meeting_booked"].includes(c.status)).length,
    booked: allContacts.filter((c) => ["trial_shoot", "paying_client"].includes(c.status)).length,
    churned: allContacts.filter((c) => c.status === "churned").length,
  }

  // ── Shoots ───────────────────────────────────────────────────────────────────
  const weekShoots = shoots ?? []
  const avgDeliveryHours =
    weekShoots.length > 0
      ? Math.round(
          weekShoots
            .filter((s) => s.scheduled_at && s.delivered_at)
            .reduce((sum, s) => {
              const diff =
                new Date(s.delivered_at!).getTime() - new Date(s.scheduled_at!).getTime()
              return sum + diff / 3600000
            }, 0) / Math.max(weekShoots.filter((s) => s.scheduled_at && s.delivered_at).length, 1)
        )
      : 0

  // Slot usage
  const { count: activeToursCount } = await supabase
    .from("tours")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
  const { data: slotSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "matterport_slot_limit")
    .single()
  const slotLimit = parseInt(slotSetting?.value ?? "25", 10)
  const slotUsagePct =
    slotLimit > 0 ? Math.round(((activeToursCount ?? 0) / slotLimit) * 100) : 0

  // ── Marketing ────────────────────────────────────────────────────────────────
  const spend = spendRows ?? []
  const totalSpend = spend.reduce((s, r) => s + (r.amount_spent ?? 0), 0)

  const spendByChannel: Record<string, number> = {}
  const leadsByChannel: Record<string, number> = {}
  for (const row of spend) {
    spendByChannel[row.channel] = (spendByChannel[row.channel] ?? 0) + row.amount_spent
    leadsByChannel[row.channel] =
      (leadsByChannel[row.channel] ?? 0) + (row.leads_generated ?? 0)
  }

  const spendByChannelArr = Object.entries(spendByChannel).map(([channel, amount]) => ({
    channel,
    amount,
  }))

  const costPerLeadByChannel = Object.entries(spendByChannel)
    .map(([channel, amount]) => ({
      channel,
      cost_per_lead:
        (leadsByChannel[channel] ?? 0) > 0
          ? Math.round(amount / leadsByChannel[channel])
          : null,
      leads: leadsByChannel[channel] ?? 0,
    }))
    .filter((c) => c.cost_per_lead !== null)

  const bestChannel =
    costPerLeadByChannel.sort((a, b) => (a.cost_per_lead ?? 0) - (b.cost_per_lead ?? 0))[0]
      ?.channel ?? null
  const worstChannel =
    costPerLeadByChannel.sort((a, b) => (b.cost_per_lead ?? 0) - (a.cost_per_lead ?? 0))[0]
      ?.channel ?? null

  // ── Content ──────────────────────────────────────────────────────────────────
  const posts = contentPosts ?? []
  const pillar_distribution: Record<string, number> = {}
  let totalEngagement = 0

  for (const post of posts) {
    pillar_distribution[post.pillar] = (pillar_distribution[post.pillar] ?? 0) + 1
    const eng = post.engagement_metrics as any
    if (eng) {
      totalEngagement +=
        (eng.likes ?? 0) + (eng.comments ?? 0) + (eng.saves ?? 0) + (eng.shares ?? 0)
    }
  }

  // ── Financial ───────────────────────────────────────────────────────────────
  const now2 = new Date()
  const year2 = now2.getFullYear()
  const yearStart2 = `${year2}-01-01`

  const [
    { data: weekPaidInvoices },
    { data: weekExpenses },
    { data: outstandingInvoices },
    { data: overdueInvoicesW },
    { data: ytdInvoices },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("total, gst, qst")
      .eq("status", "paid")
      .gte("paid_at", `${start}T00:00:00Z`)
      .lte("paid_at", `${end}T23:59:59Z`),
    supabase
      .from("expenses")
      .select("amount")
      .gte("date", start)
      .lte("date", end),
    supabase.from("invoices").select("total").eq("status", "sent"),
    supabase.from("invoices").select("total").eq("status", "overdue"),
    supabase
      .from("invoices")
      .select("total, gst, qst")
      .eq("status", "paid")
      .gte("paid_at", yearStart2),
  ])

  const revenueWeek = (weekPaidInvoices ?? []).reduce((s, i) => s + (i.total ?? 0), 0)
  const expensesWeek = (weekExpenses ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  const netProfitWeek = revenueWeek - expensesWeek
  const outstandingTotal = (outstandingInvoices ?? []).reduce((s, i) => s + (i.total ?? 0), 0)
  const overdueTotal = (overdueInvoicesW ?? []).reduce((s, i) => s + (i.total ?? 0), 0)
  const ytdRevenue = (ytdInvoices ?? []).reduce((s, i) => s + (i.total ?? 0), 0)
  const gstCollectedMtd = (ytdInvoices ?? []).reduce((s, i) => s + (i.gst ?? 0), 0)
  const qstCollectedMtd = (ytdInvoices ?? []).reduce((s, i) => s + (i.qst ?? 0), 0)
  const threshold30kPct = Math.min((ytdRevenue / 30000) * 100, 100)

  const financial = {
    revenue_week: revenueWeek,
    expenses_week: expensesWeek,
    net_profit_week: netProfitWeek,
    outstanding_total: outstandingTotal,
    overdue_total: overdueTotal,
    gst_collected_mtd: gstCollectedMtd,
    qst_collected_mtd: qstCollectedMtd,
    ytd_revenue: ytdRevenue,
    threshold_30k_pct: threshold30kPct,
  }

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const activeAlerts = await getActiveAlerts()

  // ── Compile report ───────────────────────────────────────────────────────────
  const report = {
    week: weekParam,
    week_number: weekNum,
    year,
    date_range: { start, end },
    revenue: {
      total: weekRevenue,
      vs_last_week_pct: revVsLastWeekPct,
      mtd: mtdRevenue,
      goal: monthGoal,
      goal_pct: goalPct,
    },
    outreach: {
      emails_sent: emailsSent,
      opened: emailsOpened,
      replied: emailsReplied,
      reply_rate: replyRate,
      reply_rate_vs_last_week: replyRateVsLastWeek,
      pipeline_snapshot,
    },
    shoots: {
      completed: weekShoots.length,
      vs_last_week: weekShoots.length - (prevShoots?.length ?? 0),
      avg_delivery_hours: avgDeliveryHours,
      slot_usage_pct: slotUsagePct,
      slot_active: activeToursCount ?? 0,
      slot_limit: slotLimit,
    },
    marketing: {
      total_spend: totalSpend,
      spend_by_channel: spendByChannelArr,
      cost_per_lead_by_channel: costPerLeadByChannel,
      best_channel: bestChannel,
      worst_channel: worstChannel,
    },
    content: {
      posts_published: posts.length,
      pillar_distribution,
      total_engagement: totalEngagement,
    },
    financial,
    alerts: activeAlerts,
    daily_sparklines: {
      revenue: days.map((d) => ({ date: d.date, value: d.revenue })),
      emails_sent: days.map((d) => ({ date: d.date, value: d.emails_sent })),
      ad_spend: days.map((d) => ({ date: d.date, value: d.ad_spend })),
    },
  }

  return NextResponse.json(report)
}
