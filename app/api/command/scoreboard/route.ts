import { NextResponse } from "next/server"
import { createAdminClient as createClient } from "@/lib/supabase/server"

function getWeekBounds(date: Date) {
  // Monday = start of week
  const day = date.getDay() || 7 // Sunday=7
  const monday = new Date(date)
  monday.setDate(date.getDate() - (day - 1))
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const lastMonday = new Date(monday)
  lastMonday.setDate(monday.getDate() - 7)
  const lastSunday = new Date(monday)
  lastSunday.setDate(monday.getDate() - 1)
  lastSunday.setHours(23, 59, 59, 999)

  return {
    thisWeekStart: monday.toISOString(),
    thisWeekEnd: sunday.toISOString(),
    lastWeekStart: lastMonday.toISOString(),
    lastWeekEnd: lastSunday.toISOString(),
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const now = new Date()
  const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } = getWeekBounds(now)

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const yearStart = `${now.getFullYear()}-01-01`

  // Parallel fetches
  const [
    // Revenue: paid invoices this week
    { data: revenueThisWeek },
    { data: revenueLastWeek },
    { data: revenueMtd },
    // Shoots
    { data: shootsBookedThisWeek },
    { data: shootsCompletedThisWeek },
    { data: shootsBookedLastWeek },
    { data: shootsCompletedLastWeek },
    // Outreach
    { data: emailsThisWeek },
    { data: emailsLastWeek },
    // Pipeline
    { data: contacts },
    // Meta ads
    { data: adSpendThisWeek },
    { data: adSpendLastWeek },
    { data: adSpendMtd },
    // Goal
    { data: goalSetting },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", thisWeekStart)
      .lte("paid_at", thisWeekEnd),

    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", lastWeekStart)
      .lte("paid_at", lastWeekEnd),

    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", startOfMonth),

    supabase
      .from("shoots")
      .select("id")
      .in("status", ["booked", "confirmed", "shot", "processing", "delivered", "paid"])
      .gte("created_at", thisWeekStart)
      .lte("created_at", thisWeekEnd),

    supabase
      .from("shoots")
      .select("id")
      .in("status", ["delivered", "paid"])
      .gte("delivered_at", thisWeekStart)
      .lte("delivered_at", thisWeekEnd),

    supabase
      .from("shoots")
      .select("id")
      .in("status", ["booked", "confirmed", "shot", "processing", "delivered", "paid"])
      .gte("created_at", lastWeekStart)
      .lte("created_at", lastWeekEnd),

    supabase
      .from("shoots")
      .select("id")
      .in("status", ["delivered", "paid"])
      .gte("delivered_at", lastWeekStart)
      .lte("delivered_at", lastWeekEnd),

    supabase
      .from("outreach_emails")
      .select("id, status, replied_at")
      .not("status", "eq", "draft")
      .gte("sent_at", thisWeekStart)
      .lte("sent_at", thisWeekEnd),

    supabase
      .from("outreach_emails")
      .select("id, status")
      .not("status", "eq", "draft")
      .gte("sent_at", lastWeekStart)
      .lte("sent_at", lastWeekEnd),

    supabase
      .from("contacts")
      .select("id, status"),

    supabase
      .from("marketing_spend")
      .select("amount_spent, clicks, impressions")
      .gte("date", thisWeekStart.slice(0, 10))
      .lte("date", thisWeekEnd.slice(0, 10)),

    supabase
      .from("marketing_spend")
      .select("amount_spent, clicks, impressions")
      .gte("date", lastWeekStart.slice(0, 10))
      .lte("date", lastWeekEnd.slice(0, 10)),

    supabase
      .from("marketing_spend")
      .select("amount_spent")
      .gte("date", startOfMonth.slice(0, 10)),

    supabase
      .from("settings")
      .select("value")
      .eq("key", "monthly_revenue_goal")
      .single(),
  ])

  // Revenue
  const revenueThisWeekTotal = (revenueThisWeek ?? []).reduce((s, r) => s + r.total, 0)
  const revenueLastWeekTotal = (revenueLastWeek ?? []).reduce((s, r) => s + r.total, 0)
  const revenueMtdTotal = (revenueMtd ?? []).reduce((s, r) => s + r.total, 0)
  const goal = parseFloat(goalSetting?.value ?? "3000")
  const goalPct = goal > 0 ? Math.min((revenueMtdTotal / goal) * 100, 100) : 0

  // Shoots
  const shootsBookedTW = shootsBookedThisWeek?.length ?? 0
  const shootsCompletedTW = shootsCompletedThisWeek?.length ?? 0
  const shootsBookedLW = shootsBookedLastWeek?.length ?? 0
  const shootsCompletedLW = shootsCompletedLastWeek?.length ?? 0

  // Outreach
  const sentTW = emailsThisWeek?.length ?? 0
  const repliesTW = (emailsThisWeek ?? []).filter((e) => e.status === "replied" || e.replied_at).length
  const replyRateTW = sentTW > 0 ? (repliesTW / sentTW) * 100 : 0

  const sentLW = emailsLastWeek?.length ?? 0
  const repliesLW = (emailsLastWeek ?? []).filter((e) => e.status === "replied").length
  const replyRateLW = sentLW > 0 ? (repliesLW / sentLW) * 100 : 0

  // Pipeline by stage
  const allContacts = contacts ?? []
  const pipeline: Record<string, number> = {}
  for (const c of allContacts) {
    pipeline[c.status] = (pipeline[c.status] ?? 0) + 1
  }

  // Meta ads
  const adSpendTW = (adSpendThisWeek ?? []).reduce((s, r) => s + (r.amount_spent ?? 0), 0)
  const adResultsTW = (adSpendThisWeek ?? []).reduce((s, r) => s + (r.clicks ?? 0), 0)
  const adSpendLW = (adSpendLastWeek ?? []).reduce((s, r) => s + (r.amount_spent ?? 0), 0)
  const adResultsLW = (adSpendLastWeek ?? []).reduce((s, r) => s + (r.clicks ?? 0), 0)
  const adSpendMtdTotal = (adSpendMtd ?? []).reduce((s, r) => s + (r.amount_spent ?? 0), 0)
  const cprTW = adResultsTW > 0 ? adSpendTW / adResultsTW : null

  return NextResponse.json({
    revenue: {
      this_week: revenueThisWeekTotal,
      last_week: revenueLastWeekTotal,
      mtd: revenueMtdTotal,
      goal,
      goal_pct: goalPct,
      delta_pct: revenueLastWeekTotal > 0
        ? ((revenueThisWeekTotal - revenueLastWeekTotal) / revenueLastWeekTotal) * 100
        : null,
    },
    shoots: {
      booked_this_week: shootsBookedTW,
      completed_this_week: shootsCompletedTW,
      booked_last_week: shootsBookedLW,
      completed_last_week: shootsCompletedLW,
    },
    outreach: {
      sent_this_week: sentTW,
      replies_this_week: repliesTW,
      reply_rate_this_week: replyRateTW,
      sent_last_week: sentLW,
      replies_last_week: repliesLW,
      reply_rate_last_week: replyRateLW,
      pipeline,
    },
    meta: {
      spend_this_week: adSpendTW,
      results_this_week: adResultsTW,
      cpr: cprTW,
      spend_last_week: adSpendLW,
      results_last_week: adResultsLW,
      spend_mtd: adSpendMtdTotal,
    },
  })
}
