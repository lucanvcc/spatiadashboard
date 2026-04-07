import { runCronJob, getSupabaseAdmin } from "./run-job"

// Get ISO week number from a Date
function getISOWeek(d: Date): { weekNum: number; year: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayOfWeek = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { weekNum, year: date.getUTCFullYear() }
}

// Parse YYYY-WW into { start, end } date strings
function parseISOWeek(year: number, weekNum: number): { start: string; end: string } {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1) + (weekNum - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  return {
    start: weekStart.toISOString().slice(0, 10),
    end: weekEnd.toISOString().slice(0, 10),
  }
}

export async function runWeeklyReport() {
  return runCronJob("weekly-report", async () => {
    const supabase = getSupabaseAdmin()

    // Last completed week: today is Monday, so last week = the week that just ended
    const today = new Date()
    const lastWeekDate = new Date(today)
    lastWeekDate.setUTCDate(today.getUTCDate() - 7)

    const { weekNum, year } = getISOWeek(lastWeekDate)
    const { start, end } = parseISOWeek(year, weekNum)
    const prevStart = new Date(start)
    prevStart.setUTCDate(prevStart.getUTCDate() - 7)
    const prevEnd = new Date(end)
    prevEnd.setUTCDate(prevEnd.getUTCDate() - 7)
    const prevStartStr = prevStart.toISOString().slice(0, 10)
    const prevEndStr = prevEnd.toISOString().slice(0, 10)

    // Pull all data
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
      { count: activeToursCount },
      { data: slotSetting },
    ] = await Promise.all([
      supabase
        .from("analytics_daily")
        .select("date, emails_sent, emails_opened, replies, shoots_booked, revenue, ad_spend")
        .gte("date", start)
        .lte("date", end),
      supabase
        .from("analytics_daily")
        .select("date, emails_sent, emails_opened, replies, shoots_booked, revenue, ad_spend")
        .gte("date", prevStartStr)
        .lte("date", prevEndStr),
      supabase.from("contacts").select("status"),
      supabase
        .from("shoots")
        .select("id, status, scheduled_at, delivered_at, total_price")
        .gte("delivered_at", `${start}T00:00:00Z`)
        .lte("delivered_at", `${end}T23:59:59Z`),
      supabase
        .from("shoots")
        .select("id")
        .gte("delivered_at", `${prevStartStr}T00:00:00Z`)
        .lte("delivered_at", `${prevEndStr}T23:59:59Z`),
      supabase
        .from("marketing_spend")
        .select("channel, amount_spent, leads_generated")
        .gte("date", start)
        .lte("date", end),
      supabase
        .from("content_calendar")
        .select("pillar, status, engagement_metrics, posted_at")
        .gte("posted_at", `${start}T00:00:00Z`)
        .lte("posted_at", `${end}T23:59:59Z`),
      supabase
        .from("revenue_events")
        .select("amount")
        .gte("date", `${end.slice(0, 7)}-01`)
        .lte("date", end),
      supabase.from("settings").select("value").eq("key", "monthly_revenue_goal").single(),
      supabase.from("tours").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("settings").select("value").eq("key", "matterport_slot_limit").single(),
    ])

    const days = weekDays ?? []
    const prevDays = prevWeekDays ?? []

    // Revenue
    const weekRevenue = days.reduce((s, d) => s + (d.revenue ?? 0), 0)
    const prevRevenue = prevDays.reduce((s, d) => s + (d.revenue ?? 0), 0)
    const revVsLastWeekPct =
      prevRevenue > 0 ? Math.round(((weekRevenue - prevRevenue) / prevRevenue) * 100) : null
    const mtdRevenue = (monthRevenue ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
    const monthGoal = parseInt(goalSetting?.value ?? "3000", 10)
    const goalPct = monthGoal > 0 ? Math.round((mtdRevenue / monthGoal) * 100) : null

    // Outreach
    const emailsSent = days.reduce((s, d) => s + (d.emails_sent ?? 0), 0)
    const emailsOpened = days.reduce((s, d) => s + (d.emails_opened ?? 0), 0)
    const emailsReplied = days.reduce((s, d) => s + (d.replies ?? 0), 0)
    const replyRate = emailsSent > 0 ? Math.round((emailsReplied / emailsSent) * 100) : 0
    const prevEmailsSent = prevDays.reduce((s, d) => s + (d.emails_sent ?? 0), 0)
    const prevReplied = prevDays.reduce((s, d) => s + (d.replies ?? 0), 0)
    const prevReplyRate =
      prevEmailsSent > 0 ? Math.round((prevReplied / prevEmailsSent) * 100) : 0

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

    // Shoots
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
              }, 0) /
              Math.max(weekShoots.filter((s) => s.scheduled_at && s.delivered_at).length, 1)
          )
        : 0

    const slotLimit = parseInt(slotSetting?.value ?? "25", 10)
    const slotUsagePct =
      slotLimit > 0 ? Math.round(((activeToursCount ?? 0) / slotLimit) * 100) : 0

    // Marketing
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
    const sortedCpl = [...costPerLeadByChannel].sort(
      (a, b) => (a.cost_per_lead ?? 0) - (b.cost_per_lead ?? 0)
    )
    const bestChannel = sortedCpl[0]?.channel ?? null
    const worstChannel = sortedCpl[sortedCpl.length - 1]?.channel ?? null

    // Content
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

    const report = {
      week: `${year}-${String(weekNum).padStart(2, "0")}`,
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
        reply_rate_vs_last_week: replyRate - prevReplyRate,
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
      alerts: [],
      daily_sparklines: {
        revenue: days.map((d) => ({ date: d.date, value: d.revenue })),
        emails_sent: days.map((d) => ({ date: d.date, value: d.emails_sent })),
        ad_spend: days.map((d) => ({ date: d.date, value: d.ad_spend })),
      },
    }

    // Store in weekly_reports (upsert in case re-run)
    const { error } = await supabase.from("weekly_reports").upsert(
      {
        week_number: weekNum,
        year,
        data_json: report,
      },
      { onConflict: "year,week_number" }
    )

    if (error) throw new Error(error.message)

    return `week ${year}-W${weekNum} report stored (${weekShoots.length} shoots, $${weekRevenue.toFixed(2)} revenue, ${emailsSent} emails)`
  })
}
