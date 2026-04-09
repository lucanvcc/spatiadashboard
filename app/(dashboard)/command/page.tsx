import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/pricing"
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Camera,
  Clock,
  DollarSign,
  Mail,
  Users,
  Box,
  Upload,
  Bell,
  TrendingUp,
  TrendingDown,
  Zap,
  Flame,
  Activity,
  Target,
  Layers,
} from "lucide-react"
import { ActionItemsPanel } from "@/components/command/action-items-panel"
import { RevenueSpeedometerSVG } from "@/components/command/revenue-speedometer"
import { WeeklyWins } from "@/components/command/weekly-wins"

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function getQuickStats() {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const yearStart = `${now.getFullYear()}-01-01`

  const [
    { data: paidMtd },
    { data: outstanding },
    { data: contacts },
    { count: activeTours },
    { data: slotSetting },
    { data: adSpendMtd },
    { data: nextShoot },
  ] = await Promise.all([
    supabase.from("invoices").select("total").eq("status", "paid").gte("paid_at", startOfMonth),
    supabase.from("invoices").select("total").in("status", ["sent", "overdue"]),
    supabase
      .from("contacts")
      .select("id, status")
      .not("status", "in", '("churned","paying_client")'),
    supabase.from("tours").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("settings").select("value").eq("key", "matterport_slot_limit").single(),
    supabase
      .from("marketing_spend")
      .select("amount_spent")
      .gte("date", startOfMonth),
    supabase
      .from("shoots")
      .select("id, address, scheduled_at")
      .in("status", ["booked", "confirmed"])
      .gte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1),
  ])

  const revenueMtd = (paidMtd ?? []).reduce((s, r) => s + r.total, 0)
  const outstandingTotal = (outstanding ?? []).reduce((s, r) => s + r.total, 0)
  const activePipeline = (contacts ?? []).filter(
    (c) => !["churned", "paying_client"].includes(c.status)
  ).length
  const slotLimit = parseInt(slotSetting?.value ?? "25", 10)
  const adSpendMtdTotal = (adSpendMtd ?? []).reduce((s, r) => s + (r.amount_spent ?? 0), 0)

  return {
    revenueMtd,
    outstandingTotal,
    activePipeline,
    activeTours: activeTours ?? 0,
    slotLimit,
    adSpendMtdTotal,
    nextShoot: nextShoot?.[0] ?? null,
  }
}

async function getActionItemCount() {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { count } = await supabase
    .from("action_items")
    .select("id", { count: "exact", head: true })
    .eq("is_resolved", false)
    .eq("is_dismissed", false)
    .in("severity", ["critical", "warning"])
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  return count ?? 0
}

async function getScoreboard() {
  const supabase = await createClient()
  const now = new Date()

  // Week bounds (Monday-based)
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day - 1))
  monday.setHours(0, 0, 0, 0)
  const thisWeekStart = monday.toISOString()

  const lastMonday = new Date(monday)
  lastMonday.setDate(monday.getDate() - 7)
  const lastSunday = new Date(monday)
  lastSunday.setDate(monday.getDate() - 1)
  lastSunday.setHours(23, 59, 59, 999)

  const [
    { data: revTW },
    { data: revLW },
    { data: shootsTW },
    { data: shootsLW },
    { data: emailsTW },
    { data: emailsLW },
    { data: contacts },
    { data: adSpendTW },
    { data: adSpendLW },
    { data: goalSetting },
    { data: outreachTargetSetting },
  ] = await Promise.all([
    supabase.from("invoices").select("total").eq("status", "paid")
      .gte("paid_at", thisWeekStart).lte("paid_at", now.toISOString()),
    supabase.from("invoices").select("total").eq("status", "paid")
      .gte("paid_at", lastMonday.toISOString()).lte("paid_at", lastSunday.toISOString()),
    supabase.from("shoots").select("id, status")
      .in("status", ["booked", "confirmed", "delivered", "paid"])
      .gte("created_at", thisWeekStart),
    supabase.from("shoots").select("id, status")
      .in("status", ["booked", "confirmed", "delivered", "paid"])
      .gte("created_at", lastMonday.toISOString()).lte("created_at", lastSunday.toISOString()),
    supabase.from("outreach_emails").select("id, status, replied_at")
      .not("status", "eq", "draft").gte("sent_at", thisWeekStart),
    supabase.from("outreach_emails").select("id, status")
      .not("status", "eq", "draft")
      .gte("sent_at", lastMonday.toISOString()).lte("sent_at", lastSunday.toISOString()),
    supabase.from("contacts").select("id, status"),
    supabase.from("marketing_spend").select("amount_spent")
      .gte("date", thisWeekStart.slice(0, 10)),
    supabase.from("marketing_spend").select("amount_spent")
      .gte("date", lastMonday.toISOString().slice(0, 10))
      .lte("date", lastSunday.toISOString().slice(0, 10)),
    supabase.from("settings").select("value").eq("key", "monthly_revenue_goal").single(),
    supabase.from("settings").select("value").eq("key", "weekly_outreach_target").single(),
  ])

  const revTWTotal = (revTW ?? []).reduce((s, r) => s + r.total, 0)
  const revLWTotal = (revLW ?? []).reduce((s, r) => s + r.total, 0)
  const sentTW = emailsTW?.length ?? 0
  const repliesTW = (emailsTW ?? []).filter((e) => e.status === "replied" || e.replied_at).length
  const sentLW = emailsLW?.length ?? 0
  const repliesLW = (emailsLW ?? []).filter((e) => e.status === "replied").length

  const pipeline: Record<string, number> = {}
  for (const c of contacts ?? []) {
    pipeline[c.status] = (pipeline[c.status] ?? 0) + 1
  }

  return {
    revenue: {
      this_week: revTWTotal,
      last_week: revLWTotal,
      goal: parseFloat(goalSetting?.value ?? "3000"),
    },
    shoots: {
      this_week: shootsTW?.length ?? 0,
      last_week: shootsLW?.length ?? 0,
      completed_this_week: (shootsTW ?? []).filter((s) => ["delivered", "paid"].includes(s.status)).length,
      completed_last_week: (shootsLW ?? []).filter((s) => ["delivered", "paid"].includes(s.status)).length,
    },
    outreach: {
      sent_this_week: sentTW,
      replies_this_week: repliesTW,
      reply_rate_this_week: sentTW > 0 ? (repliesTW / sentTW) * 100 : 0,
      sent_last_week: sentLW,
      replies_last_week: repliesLW,
      reply_rate_last_week: sentLW > 0 ? (repliesLW / sentLW) * 100 : 0,
      pipeline,
      weekly_target: parseInt(outreachTargetSetting?.value ?? "20", 10),
    },
    meta: {
      spend_this_week: (adSpendTW ?? []).reduce((s, r) => s + (r.amount_spent ?? 0), 0),
      spend_last_week: (adSpendLW ?? []).reduce((s, r) => s + (r.amount_spent ?? 0), 0),
    },
  }
}

async function getActivityFeed() {
  const supabase = await createClient()
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [
    { data: emails },
    { data: shoots },
    { data: invoices },
    { data: cronLogs },
    { data: actionItems },
  ] = await Promise.all([
    supabase.from("outreach_emails").select("id, subject, status, sent_at, contacts(name)")
      .not("status", "eq", "draft").gte("sent_at", since)
      .order("sent_at", { ascending: false }).limit(10),
    supabase.from("shoots").select("id, address, status, updated_at")
      .gte("updated_at", since).order("updated_at", { ascending: false }).limit(8),
    supabase.from("invoices").select("id, total, status, paid_at, wave_invoice_id, contacts(name)")
      .eq("status", "paid").gte("paid_at", since)
      .order("paid_at", { ascending: false }).limit(8),
    supabase.from("cron_logs").select("id, job_name, status, result_summary, ran_at")
      .gte("ran_at", since).order("ran_at", { ascending: false }).limit(15),
    supabase.from("action_items").select("id, type, title, severity, created_at, is_resolved, resolved_at, related_url")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(10),
  ])

  type Event = {
    timestamp: string
    icon: "mail" | "camera" | "dollar-sign" | "clock" | "alert-circle" | "bell" | "check-circle" | "upload"
    label: string
    description: string
    url: string | null
    isError?: boolean
  }
  const events: Event[] = []

  for (const e of emails ?? []) {
    const name = e.contacts && !Array.isArray(e.contacts) ? (e.contacts as {name:string}).name : null
    const statusLabel = e.status === "replied" ? "répondu" : e.status === "opened" ? "ouvert" : "envoyé"
    events.push({
      timestamp: e.sent_at!,
      icon: "mail",
      label: `${name ?? e.subject} — ${statusLabel}`,
      description: e.subject,
      url: "/outreach",
    })
  }

  for (const s of shoots ?? []) {
    const statusLabel = s.status === "delivered" ? "livré" : s.status === "booked" ? "réservé" : s.status === "paid" ? "payé" : s.status
    events.push({
      timestamp: s.updated_at,
      icon: "camera",
      label: `${s.address} — ${statusLabel}`,
      description: s.address,
      url: "/operations/shoots",
    })
  }

  for (const i of invoices ?? []) {
    const name = i.contacts && !Array.isArray(i.contacts) ? (i.contacts as {name:string}).name : null
    const label = i.wave_invoice_id ?? i.id.slice(0, 8)
    events.push({
      timestamp: i.paid_at!,
      icon: "dollar-sign",
      label: `Facture #${label} payée`,
      description: `${name ? `${name} · ` : ""}${formatCurrency(i.total)}`,
      url: `/money/invoices/${i.id}`,
    })
  }

  for (const log of cronLogs ?? []) {
    const isError = log.status === "error"
    events.push({
      timestamp: log.ran_at,
      icon: isError ? "alert-circle" : "clock",
      label: `${log.job_name} ${isError ? "✗" : "✓"}`,
      description: (log.result_summary ?? "").slice(0, 60),
      url: "/settings/cron",
      isError,
    })
  }

  for (const item of actionItems ?? []) {
    if (item.is_resolved && item.resolved_at) {
      events.push({
        timestamp: item.resolved_at,
        icon: "check-circle",
        label: `Résolu: ${item.title}`,
        description: item.title,
        url: item.related_url ?? "/command",
      })
    } else {
      events.push({
        timestamp: item.created_at,
        icon: "bell",
        label: item.title,
        description: item.title,
        url: item.related_url ?? "/command",
      })
    }
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return events.slice(0, 50)
}

async function getMomentumData() {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const since14 = new Date(now.getTime() - 14 * 86400000).toISOString()
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthFraction = dayOfMonth / daysInMonth

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
    { data: newContactsW },
    { data: repliesW },
    { data: paidW },
    { data: toursDeliveredW },
  ] = await Promise.all([
    supabase.from("outreach_emails").select("sent_at")
      .not("status", "eq", "draft").not("sent_at", "is", null).gte("sent_at", since14),
    supabase.from("shoots").select("id, total_price, status, created_at").gte("created_at", startOfMonth),
    supabase.from("shoots").select("id, status, updated_at, created_at")
      .eq("status", "delivered").gte("updated_at", since30),
    supabase.from("invoices").select("id, status, due_at, paid_at, total").gte("created_at", since30),
    supabase.from("action_items").select("id")
      .eq("severity", "critical").eq("is_resolved", false).eq("is_dismissed", false),
    supabase.from("invoices").select("id, total").eq("status", "overdue"),
    supabase.from("settings").select("value").eq("key", "monthly_revenue_goal").single(),
    supabase.from("settings").select("value").eq("key", "monthly_break_even").single(),
    supabase.from("expenses").select("amount").gte("date", startOfMonth.slice(0, 10)),
    // Weekly wins data
    supabase.from("contacts").select("id").gte("created_at", new Date(now.getTime() - 7 * 86400000).toISOString()),
    supabase.from("outreach_emails").select("id").eq("status", "replied")
      .gte("replied_at", new Date(now.getTime() - 7 * 86400000).toISOString()),
    supabase.from("invoices").select("total").eq("status", "paid")
      .gte("paid_at", new Date(now.getTime() - 7 * 86400000).toISOString()),
    supabase.from("shoots").select("id").eq("status", "delivered")
      .gte("updated_at", new Date(now.getTime() - 7 * 86400000).toISOString()),
  ])

  // Momentum pillars
  const sentDates = new Set((recentEmails ?? []).map((e) => e.sent_at!.slice(0, 10)))
  const consistencyScore = Math.round((sentDates.size / 14) * 25)

  const revGoal = parseFloat(goalSetting?.value ?? "3000")
  const completedShoots = (shootsMtd ?? []).filter((s) =>
    ["shot", "processing", "delivered", "paid"].includes(s.status)
  )
  const shootRevenueMtd = completedShoots.reduce((s, sh) => s + (sh.total_price ?? 0), 0)
  const expectedRevenuePace = revGoal * monthFraction
  const bookingScore = expectedRevenuePace > 0
    ? Math.min(Math.round((shootRevenueMtd / expectedRevenuePace) * 25), 25)
    : 12

  const deliverySpeeds = (deliveredShoots ?? []).map((s) => {
    return (new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()) / 86400000
  }).filter((d) => d >= 0 && d < 30)
  let deliveryScore = 20
  if (deliverySpeeds.length > 0) {
    const avg = deliverySpeeds.reduce((a, b) => a + b, 0) / deliverySpeeds.length
    if (avg < 1) deliveryScore = 25
    else if (avg < 2) deliveryScore = 23
    else if (avg < 3) deliveryScore = 20
    else if (avg < 4) deliveryScore = 15
    else if (avg < 5) deliveryScore = 8
    else deliveryScore = 0
  }

  const dueInvoices = (invoices30 ?? []).filter((i) => i.due_at)
  const paidOnTime = dueInvoices.filter((i) => {
    if (i.status !== "paid" || !i.paid_at || !i.due_at) return false
    return new Date(i.paid_at).getTime() <= new Date(i.due_at).getTime() + 14 * 86400000
  })
  const collectionScore = dueInvoices.length > 0
    ? Math.round((paidOnTime.length / dueInvoices.length) * 25)
    : 20

  const momentum = Math.min(consistencyScore + bookingScore + deliveryScore + collectionScore, 100)

  // Live Pulse
  const criticalCount = criticalItems?.length ?? 0
  const overdueCount = overdueInvoices?.length ?? 0
  const overdueAmount = (overdueInvoices ?? []).reduce((s, i) => s + i.total, 0)
  let pulse: "green" | "yellow" | "red" = "green"
  if (criticalCount > 0 || overdueCount > 2 || momentum < 40) pulse = "red"
  else if (momentum < 70 || overdueCount > 0 || overdueAmount > 500) pulse = "yellow"

  // Break-even
  const breakEvenTarget = parseFloat(breakEvenSetting?.value ?? "300")
  const expensesThisMonth = (expensesMtd ?? []).reduce((s, e) => s + e.amount, 0)
  const fixedCosts = Math.max(breakEvenTarget, expensesThisMonth)
  const avgShootPrice = completedShoots.length > 0
    ? completedShoots.reduce((s, sh) => s + (sh.total_price ?? 175), 0) / completedShoots.length
    : 175
  const shootsNeeded = Math.ceil(fixedCosts / avgShootPrice)
  const shootsDone = completedShoots.length

  // Pipeline value: booked shoots + outstanding invoices
  const bookedShootValue = (shootsMtd ?? [])
    .filter((s) => ["booked", "shot", "processing"].includes(s.status))
    .reduce((s, sh) => s + (sh.total_price ?? 0), 0)
  const outstandingInvoiceValue = (invoices30 ?? [])
    .filter((i) => ["sent", "overdue"].includes(i.status))
    .reduce((s, i) => s + i.total, 0)
  const pipelineValue = bookedShootValue + outstandingInvoiceValue

  // Revenue speedometer
  const revenueMtd = (shootsMtd ?? [])
    .filter((s) => s.status === "paid")
    .reduce((s, sh) => s + (sh.total_price ?? 0), 0)
  // Also get from paid invoices
  const paidInvoicesMtd = (invoices30 ?? [])
    .filter((i) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= new Date(startOfMonth))
    .reduce((s, i) => s + i.total, 0)
  const revenueForGauge = Math.max(revenueMtd, paidInvoicesMtd)
  const paceTarget = revGoal * monthFraction

  // Weekly wins
  type Win = { label: string; value: string; emoji: string }
  const wins: Win[] = []
  const newContactsCount = newContactsW?.length ?? 0
  const repliesCount = repliesW?.length ?? 0
  const paidAmount = (paidW ?? []).reduce((s, i) => s + i.total, 0)
  const toursDelivered = toursDeliveredW?.length ?? 0
  const shootsBookedMtd = (shootsMtd ?? []).filter(s => s.status !== "paid").length

  if (paidAmount > 0) wins.push({ emoji: "💰", value: formatCurrency(paidAmount), label: "encaissés" })
  if (toursDelivered > 0) wins.push({ emoji: "📦", value: String(toursDelivered), label: toursDelivered > 1 ? "tours livrés" : "tour livré" })
  if (repliesCount > 0) wins.push({ emoji: "✉️", value: String(repliesCount), label: repliesCount > 1 ? "réponses reçues" : "réponse reçue" })
  if (newContactsCount > 0) wins.push({ emoji: "👤", value: String(newContactsCount), label: newContactsCount > 1 ? "nouveaux contacts" : "nouveau contact" })
  if (shootsBookedMtd > 0 && wins.length < 4) wins.push({ emoji: "📷", value: String(shootsBookedMtd), label: shootsBookedMtd > 1 ? "shoots en cours" : "shoot en cours" })

  return {
    momentum,
    pulse,
    shootsNeeded,
    shootsDone,
    fixedCosts,
    pipelineValue,
    revenueForGauge,
    revGoal,
    paceTarget,
    wins,
  }
}

async function getOutreachStreak() {
  const supabase = await createClient()
  // Look back up to 60 days
  const since = new Date()
  since.setDate(since.getDate() - 60)

  const { data: emails } = await supabase
    .from("outreach_emails")
    .select("sent_at")
    .not("status", "eq", "draft")
    .not("sent_at", "is", null)
    .gte("sent_at", since.toISOString())
    .order("sent_at", { ascending: false })

  if (!emails || emails.length === 0) return { streak: 0, lastSentDaysAgo: null }

  // Build a set of dates (YYYY-MM-DD) that had sent emails
  const sentDates = new Set(
    emails.map((e) => e.sent_at!.slice(0, 10))
  )

  // Count consecutive days backwards from today
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // If no email sent today, check if yesterday starts the streak
  let checkDate = new Date(today)
  // First check today
  let dateStr = checkDate.toISOString().slice(0, 10)
  if (!sentDates.has(dateStr)) {
    // No email today — streak starts from yesterday (if applicable)
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Now count backwards
  for (let i = 0; i < 60; i++) {
    const ds = checkDate.toISOString().slice(0, 10)
    if (sentDates.has(ds)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  // Days since last email
  const lastEmail = emails[0]
  const lastSentDaysAgo = lastEmail?.sent_at
    ? Math.floor((Date.now() - new Date(lastEmail.sent_at).getTime()) / 86400000)
    : null

  return { streak, lastSentDaysAgo }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Delta({ value, isPositiveBetter = true }: { value: number | null; isPositiveBetter?: boolean }) {
  if (value === null || value === 0) return <span className="text-muted-foreground/50 text-xs">—</span>
  const isGood = isPositiveBetter ? value > 0 : value < 0
  const Icon = value > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`flex items-center gap-0.5 text-xs ${isGood ? "text-emerald-400" : "text-red-400"}`}>
      <Icon size={10} strokeWidth={1.5} />
      {Math.abs(value).toFixed(0)}%
    </span>
  )
}

function StatStrip({
  revenueMtd, outstandingTotal, activePipeline, activeTours, slotLimit, adSpendMtdTotal, nextShoot,
}: Awaited<ReturnType<typeof getQuickStats>>) {
  const nextShootDate = nextShoot?.scheduled_at
    ? new Date(nextShoot.scheduled_at).toLocaleDateString("fr-CA", {
        weekday: "short", month: "short", day: "numeric",
      })
    : null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px border border-border bg-border/50">
      {[
        { label: "revenu MTD", value: formatCurrency(revenueMtd) },
        { label: "en attente", value: formatCurrency(outstandingTotal), warn: outstandingTotal > 0 },
        { label: "pipeline actif", value: activePipeline.toString() },
        { label: "slots matterport", value: `${activeTours}/${slotLimit}`, warn: activeTours > slotLimit * 0.8 },
        { label: "pub MTD", value: formatCurrency(adSpendMtdTotal) },
        { label: "prochain shoot", value: nextShootDate ?? "aucun" },
      ].map((stat) => (
        <div key={stat.label} className="bg-card px-4 py-3 space-y-1">
          <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">{stat.label}</p>
          <p className={`font-mono text-sm font-medium ${stat.warn ? "text-amber-400" : "text-foreground"}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function ScoreCard({
  label, thisWeek, lastWeek, format = "number", isPositiveBetter = true,
}: {
  label: string
  thisWeek: number
  lastWeek: number
  format?: "number" | "currency" | "percent"
  isPositiveBetter?: boolean
}) {
  const delta = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : null
  const formatted =
    format === "currency" ? formatCurrency(thisWeek) :
    format === "percent" ? `${thisWeek.toFixed(0)}%` :
    thisWeek.toFixed(0)

  return (
    <div className="space-y-1">
      <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className="font-mono text-xl text-foreground">{formatted}</p>
      <Delta value={delta} isPositiveBetter={isPositiveBetter} />
    </div>
  )
}

function feedIcon(icon: string, isError?: boolean) {
  const cls = `shrink-0 mt-0.5 ${isError ? "text-red-400" : "text-muted-foreground"}`
  const props = { size: 12, strokeWidth: 1.5, className: cls }
  switch (icon) {
    case "mail": return <Mail {...props} />
    case "camera": return <Camera {...props} />
    case "dollar-sign": return <DollarSign {...props} />
    case "clock": return <Clock {...props} />
    case "alert-circle": return <AlertCircle {...props} />
    case "bell": return <Bell {...props} />
    case "check-circle": return <CheckCircle {...props} className="shrink-0 mt-0.5 text-emerald-400" />
    case "upload": return <Upload {...props} />
    default: return <Bell {...props} />
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  if (hrs >= 24) return `${Math.floor(hrs / 24)}j`
  if (hrs > 0) return `${hrs}h`
  if (mins > 0) return `${mins}m`
  return "maintenant"
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function CommandPage() {
  const [quickStats, scoreboard, activityFeed, outreachStreak, momentumData] = await Promise.all([
    getQuickStats(),
    getScoreboard(),
    getActivityFeed(),
    getOutreachStreak(),
    getMomentumData(),
  ])

  const revDelta = scoreboard.revenue.last_week > 0
    ? ((scoreboard.revenue.this_week - scoreboard.revenue.last_week) / scoreboard.revenue.last_week) * 100
    : null

  const pulseColor = {
    green: "bg-emerald-400",
    yellow: "bg-amber-400",
    red: "bg-red-400",
  }[momentumData.pulse]

  const pulseLabel = {
    green: "tout est ok",
    yellow: "attention requise",
    red: "action nécessaire",
  }[momentumData.pulse]

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Live pulse dot */}
          <div className="relative flex items-center justify-center w-5 h-5" title={pulseLabel}>
            <span className={`absolute w-3 h-3 rounded-full ${pulseColor} opacity-30 animate-ping`} />
            <span className={`relative w-2 h-2 rounded-full ${pulseColor}`} />
          </div>
          <div>
            <h1 className="font-heading text-2xl tracking-tight">command center</h1>
            <p className="text-muted-foreground text-xs mt-0.5 spatia-label">
              {new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {" · "}
              <span className={momentumData.pulse === "green" ? "text-emerald-400/70" : momentumData.pulse === "red" ? "text-red-400/70" : "text-amber-400/70"}>
                {pulseLabel}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 border border-border/50 text-muted-foreground">
          <Zap size={11} strokeWidth={1.5} />
          <span className="spatia-label text-xs">⌘K pour lancer une commande</span>
        </div>
      </div>

      {/* Momentum + Pipeline + Break-even strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border border-border bg-border/50">
        {/* Momentum score */}
        <div className="bg-card px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Activity size={10} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">momentum</p>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className={`font-mono text-xl font-medium ${
              momentumData.momentum >= 70 ? "text-emerald-400" :
              momentumData.momentum >= 40 ? "text-amber-400" : "text-red-400"
            }`}>
              {momentumData.momentum}
            </p>
            <span className="spatia-label text-[10px] text-muted-foreground">/100</span>
          </div>
          {/* Mini progress bar */}
          <div className="h-0.5 bg-border/40">
            <div
              className={`h-full transition-all ${
                momentumData.momentum >= 70 ? "bg-emerald-400/60" :
                momentumData.momentum >= 40 ? "bg-amber-400/60" : "bg-red-400/60"
              }`}
              style={{ width: `${momentumData.momentum}%` }}
            />
          </div>
        </div>

        {/* Pipeline value */}
        <div className="bg-card px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Layers size={10} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">pipeline $</p>
          </div>
          <p className="font-mono text-xl font-medium text-foreground">
            {formatCurrency(momentumData.pipelineValue)}
          </p>
          <p className="spatia-label text-[10px] text-muted-foreground">en attente de paiement</p>
        </div>

        {/* Break-even tracker */}
        <div className="bg-card px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Target size={10} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">seuil rentabilité</p>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className={`font-mono text-xl font-medium ${
              momentumData.shootsDone >= momentumData.shootsNeeded ? "text-emerald-400" : "text-foreground"
            }`}>
              {momentumData.shootsDone}/{momentumData.shootsNeeded}
            </p>
          </div>
          <p className="spatia-label text-[10px] text-muted-foreground">
            {momentumData.shootsDone >= momentumData.shootsNeeded
              ? "seuil atteint ce mois"
              : `${momentumData.shootsNeeded - momentumData.shootsDone} shoots pour couvrir les coûts`}
          </p>
        </div>

        {/* Revenue pace */}
        <div className="bg-card px-4 py-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={10} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">cadence revenu</p>
          </div>
          <p className="font-mono text-xl font-medium">
            {formatCurrency(momentumData.revenueForGauge)}
          </p>
          <p className={`spatia-label text-[10px] ${
            momentumData.revenueForGauge >= momentumData.paceTarget ? "text-emerald-400/70" : "text-amber-400/70"
          }`}>
            {momentumData.paceTarget > 0
              ? `cible: ${formatCurrency(Math.round(momentumData.paceTarget))}`
              : `objectif: ${formatCurrency(momentumData.revGoal)}`}
          </p>
        </div>
      </div>

      {/* Quick Stats Strip */}
      <StatStrip {...quickStats} />

      {/* Main grid: actions + scoreboard */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Actions — left (wider) */}
        <div className="lg:col-span-3">
          <ActionItemsPanel />
        </div>

        {/* Scoreboard — right */}
        <div className="lg:col-span-2 border border-border bg-card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={13} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-xs text-muted-foreground">cette semaine</p>
          </div>

          {/* Revenue */}
          <div className="space-y-4">
            <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest border-b border-border/40 pb-1">revenu</p>
            <div className="grid grid-cols-2 gap-4">
              <ScoreCard label="cette sem." thisWeek={scoreboard.revenue.this_week} lastWeek={scoreboard.revenue.last_week} format="currency" />
              <div className="space-y-1">
                <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">objectif MTD</p>
                <p className="font-mono text-xl">{formatCurrency(scoreboard.revenue.goal)}</p>
                <div className="h-1 bg-border/40">
                  <div
                    className="h-full bg-emerald-400/70 transition-all"
                    style={{ width: `${Math.min((scoreboard.revenue.this_week / scoreboard.revenue.goal) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Shoots */}
          <div className="space-y-3">
            <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest border-b border-border/40 pb-1">shoots</p>
            <div className="grid grid-cols-2 gap-4">
              <ScoreCard label="réservés" thisWeek={scoreboard.shoots.this_week} lastWeek={scoreboard.shoots.last_week} />
              <ScoreCard label="livrés" thisWeek={scoreboard.shoots.completed_this_week} lastWeek={scoreboard.shoots.completed_last_week} />
            </div>
          </div>

          {/* Outreach */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-1">
              <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">outreach</p>
              {/* Streak indicator */}
              {outreachStreak.streak > 0 ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <Flame size={10} strokeWidth={1.5} />
                  <span className="font-mono text-[11px]">{outreachStreak.streak}j</span>
                </span>
              ) : outreachStreak.lastSentDaysAgo !== null && outreachStreak.lastSentDaysAgo > 0 ? (
                <span className="spatia-label text-[10px] text-muted-foreground/50">
                  inactif {outreachStreak.lastSentDaysAgo}j
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ScoreCard label="envoyés" thisWeek={scoreboard.outreach.sent_this_week} lastWeek={scoreboard.outreach.sent_last_week} />
              <ScoreCard label="réponses" thisWeek={scoreboard.outreach.replies_this_week} lastWeek={scoreboard.outreach.replies_last_week} />
              <ScoreCard label="taux" thisWeek={scoreboard.outreach.reply_rate_this_week} lastWeek={scoreboard.outreach.reply_rate_last_week} format="percent" />
            </div>
            {/* Weekly outreach target progress */}
            {scoreboard.outreach.weekly_target > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="spatia-label text-[10px] text-muted-foreground">cible hebdo</span>
                  <span className="spatia-label text-[10px] text-muted-foreground">
                    {scoreboard.outreach.sent_this_week} / {scoreboard.outreach.weekly_target}
                  </span>
                </div>
                <div className="h-1 bg-border/40">
                  <div
                    className={`h-full transition-all ${
                      scoreboard.outreach.sent_this_week >= scoreboard.outreach.weekly_target
                        ? "bg-emerald-400"
                        : "bg-foreground/40"
                    }`}
                    style={{ width: `${Math.min((scoreboard.outreach.sent_this_week / scoreboard.outreach.weekly_target) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div className="space-y-2">
            <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest border-b border-border/40 pb-1">pipeline</p>
            {[
              { key: "new_lead", label: "nouveaux" },
              { key: "first_email_sent", label: "contactés" },
              { key: "replied", label: "répondu" },
              { key: "paying_client", label: "clients" },
            ].map(({ key, label }) => {
              const count = scoreboard.outreach.pipeline[key] ?? 0
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="spatia-label text-xs text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs">{count}</span>
                </div>
              )
            })}
          </div>

          {/* Meta */}
          {scoreboard.meta.spend_this_week > 0 && (
            <div className="space-y-3">
              <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest border-b border-border/40 pb-1">meta ads</p>
              <ScoreCard label="pub" thisWeek={scoreboard.meta.spend_this_week} lastWeek={scoreboard.meta.spend_last_week} format="currency" isPositiveBetter={false} />
            </div>
          )}
        </div>
      </div>

      {/* Revenue Speedometer + Weekly Wins */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Speedometer */}
        <div className="border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={13} strokeWidth={1.5} className="text-muted-foreground" />
              <p className="spatia-label text-xs text-muted-foreground">vitesse revenu — objectif mensuel</p>
            </div>
            <span className="spatia-label text-[10px] text-muted-foreground">
              {momentumData.revGoal > 0 ? `${Math.round((momentumData.revenueForGauge / momentumData.revGoal) * 100)}%` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-center">
            <RevenueSpeedometerSVG
              current={momentumData.revenueForGauge}
              goal={momentumData.revGoal}
              paceTarget={momentumData.paceTarget}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="spatia-label text-muted-foreground">
              {formatCurrency(momentumData.revenueForGauge)} réalisé
            </span>
            <span className="spatia-label text-muted-foreground">
              obj. {formatCurrency(momentumData.revGoal)}
            </span>
          </div>
        </div>

        {/* Weekly Wins */}
        <div className="border border-border bg-card p-5 space-y-3 flex flex-col">
          <div className="flex items-center gap-2">
            <Zap size={13} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-xs text-muted-foreground">cette semaine</p>
          </div>
          {momentumData.wins.length > 0 ? (
            <div className="flex-1 flex flex-col justify-center space-y-2">
              <WeeklyWins wins={momentumData.wins} />
              {/* All wins list */}
              {momentumData.wins.length > 1 && (
                <div className="space-y-1 mt-2">
                  {momentumData.wins.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm leading-none">{w.emoji}</span>
                      <span className="font-mono text-sm text-foreground">{w.value}</span>
                      <span className="spatia-label text-xs text-muted-foreground">{w.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Aucune victoire cette semaine encore — en route.</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="border border-border bg-card">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <Clock size={13} strokeWidth={1.5} className="text-muted-foreground" />
          <p className="spatia-label text-xs text-muted-foreground">fil d&apos;activité — 48h</p>
        </div>
        {activityFeed.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-muted-foreground text-sm">Aucune activité récente.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {activityFeed.map((event, i) => (
              <a
                key={i}
                href={event.url ?? "#"}
                className="flex items-start gap-3 px-5 py-2.5 hover:bg-accent/30 transition-colors group"
              >
                {feedIcon(event.icon, event.isError)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate group-hover:underline underline-offset-2">
                    {event.label}
                  </p>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground/60 shrink-0">
                  {timeAgo(event.timestamp)}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
