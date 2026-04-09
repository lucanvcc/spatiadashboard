import { NextResponse } from "next/server"
import { createAdminClient as createClient } from "@/lib/supabase/server"

// ─── Momentum Score: 0-100 composite ─────────────────────────────────────────
// Four pillars, 25 pts each:
//   1. Outreach consistency   — % of last 14 days with ≥1 email sent
//   2. Booking rate           — shoots booked this month vs pace target
//   3. Delivery speed         — avg days shot→delivered (lower = better)
//   4. Payment collection     — % invoices marked paid within 14 days of due date

export async function GET() {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // 14-day window for consistency
  const since14 = new Date(now.getTime() - 14 * 86400000).toISOString()
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [
    { data: recentEmails },
    { data: shootsMtd },
    { data: deliveredShoots },
    { data: invoices30 },
    { data: criticalItems },
    { data: overdueInvoices },
    { data: goalSetting },
    { data: breakEvenSetting },
    { data: expensesMtd },
  ] = await Promise.all([
    // Pillar 1: emails sent in last 14 days
    supabase
      .from("outreach_emails")
      .select("sent_at")
      .not("status", "eq", "draft")
      .not("sent_at", "is", null)
      .gte("sent_at", since14),

    // Pillar 2: shoots booked this month
    supabase
      .from("shoots")
      .select("id, total_price, status, created_at")
      .gte("created_at", startOfMonth),

    // Pillar 3: delivered shoots with shot_at + delivered_at (use updated_at as proxy)
    supabase
      .from("shoots")
      .select("id, status, updated_at, created_at")
      .eq("status", "delivered")
      .gte("updated_at", since30),

    // Pillar 4: invoices from last 30 days
    supabase
      .from("invoices")
      .select("id, status, due_at, paid_at, total")
      .gte("created_at", since30),

    // For pulse: critical action items
    supabase
      .from("action_items")
      .select("id")
      .eq("severity", "critical")
      .eq("is_resolved", false)
      .eq("is_dismissed", false),

    // For pulse: overdue invoices
    supabase
      .from("invoices")
      .select("id, total")
      .eq("status", "overdue"),

    // Monthly revenue goal (for pace scoring)
    supabase.from("settings").select("value").eq("key", "monthly_revenue_goal").single(),

    // Break-even monthly costs
    supabase.from("settings").select("value").eq("key", "monthly_break_even").single(),

    // Expenses this month
    supabase
      .from("expenses")
      .select("amount")
      .gte("date", startOfMonth.slice(0, 10)),
  ])

  // ── Pillar 1: Outreach consistency (0-25) ──────────────────────────────────
  const sentDates = new Set(
    (recentEmails ?? []).map((e) => e.sent_at!.slice(0, 10))
  )
  const consistencyScore = Math.round((sentDates.size / 14) * 25)

  // ── Pillar 2: Booking rate (0-25) ─────────────────────────────────────────
  // Day of month elapsed
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthFraction = dayOfMonth / daysInMonth

  // Monthly goal from settings (default 3000 / avg $175/shoot ≈ 17 shoots, but let's use revenue goal paced)
  const revGoal = parseFloat(goalSetting?.value ?? "3000")

  // Revenue from booked/completed shoots this month
  const shootRevenueMtd = (shootsMtd ?? []).reduce((s, sh) => {
    if (["shot", "processing", "delivered", "paid"].includes(sh.status)) {
      return s + (sh.total_price ?? 0)
    }
    return s
  }, 0)

  const expectedRevenuePace = revGoal * monthFraction
  const bookingScore = expectedRevenuePace > 0
    ? Math.min(Math.round((shootRevenueMtd / expectedRevenuePace) * 25), 25)
    : 12 // neutral if no target or start of month

  // ── Pillar 3: Delivery speed (0-25) ───────────────────────────────────────
  // We don't have a shot_at field, so proxy: use created_at vs updated_at for delivered shoots
  // A shoot delivered in <2 days gets full marks, >5 days gets 0
  const deliverySpeeds = (deliveredShoots ?? []).map((s) => {
    const created = new Date(s.created_at).getTime()
    const updated = new Date(s.updated_at).getTime()
    return (updated - created) / 86400000
  }).filter((d) => d >= 0 && d < 30)

  let deliveryScore = 20 // default good if no data
  if (deliverySpeeds.length > 0) {
    const avg = deliverySpeeds.reduce((a, b) => a + b, 0) / deliverySpeeds.length
    // 0 days = 25, 1 day = 23, 2 days = 20, 3 days = 15, 4 days = 10, 5+ days = 0
    if (avg < 1) deliveryScore = 25
    else if (avg < 2) deliveryScore = 23
    else if (avg < 3) deliveryScore = 20
    else if (avg < 4) deliveryScore = 15
    else if (avg < 5) deliveryScore = 8
    else deliveryScore = 0
  }

  // ── Pillar 4: Payment collection (0-25) ───────────────────────────────────
  const dueInvoices = (invoices30 ?? []).filter((i) => i.due_at)
  const paidOnTime = dueInvoices.filter((i) => {
    if (i.status !== "paid" || !i.paid_at || !i.due_at) return false
    const due = new Date(i.due_at).getTime()
    const paid = new Date(i.paid_at).getTime()
    return paid <= due + 14 * 86400000 // within 14 days of due
  })

  let collectionScore = 20 // neutral if no invoices yet
  if (dueInvoices.length > 0) {
    collectionScore = Math.round((paidOnTime.length / dueInvoices.length) * 25)
  }

  const momentum = Math.min(
    consistencyScore + bookingScore + deliveryScore + collectionScore,
    100
  )

  // ── Live Pulse ────────────────────────────────────────────────────────────
  const criticalCount = criticalItems?.length ?? 0
  const overdueCount = overdueInvoices?.length ?? 0
  const overdueAmount = (overdueInvoices ?? []).reduce((s, i) => s + i.total, 0)

  let pulse: "green" | "yellow" | "red" = "green"
  if (criticalCount > 0 || overdueCount > 2 || momentum < 40) {
    pulse = "red"
  } else if (momentum < 70 || overdueCount > 0 || overdueAmount > 500) {
    pulse = "yellow"
  }

  // ── Break-even data ───────────────────────────────────────────────────────
  const breakEvenTarget = parseFloat(breakEvenSetting?.value ?? "300") // monthly fixed costs
  const expensesThisMonth = (expensesMtd ?? []).reduce((s, e) => s + e.amount, 0)
  const fixedCosts = Math.max(breakEvenTarget, expensesThisMonth)

  // Average shoot price from this month's shoots
  const completedShoots = (shootsMtd ?? []).filter((s) =>
    ["shot", "processing", "delivered", "paid"].includes(s.status)
  )
  const avgShootPrice = completedShoots.length > 0
    ? completedShoots.reduce((s, sh) => s + (sh.total_price ?? 175), 0) / completedShoots.length
    : 175 // default tier-1 price

  const shootsNeeded = Math.ceil(fixedCosts / avgShootPrice)
  const shootsDone = completedShoots.length

  // ── Pipeline value ────────────────────────────────────────────────────────
  // Booked shoots not yet invoiced + sent/overdue invoices
  const bookedShootValue = (shootsMtd ?? [])
    .filter((s) => ["booked", "shot", "processing", "delivering"].includes(s.status))
    .reduce((s, sh) => s + (sh.total_price ?? 0), 0)

  const outstandingInvoiceValue = (invoices30 ?? [])
    .filter((i) => ["sent", "overdue"].includes(i.status))
    .reduce((s, i) => s + i.total, 0)

  const pipelineValue = bookedShootValue + outstandingInvoiceValue

  return NextResponse.json({
    momentum,
    pulse,
    pillars: {
      consistency: consistencyScore,
      booking: bookingScore,
      delivery: deliveryScore,
      collection: collectionScore,
    },
    breakEven: {
      shootsNeeded,
      shootsDone,
      fixedCosts,
      avgShootPrice: Math.round(avgShootPrice),
    },
    pipelineValue,
    criticalCount,
    overdueCount,
    overdueAmount,
  })
}
