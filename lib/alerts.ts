import { createClient } from "@/lib/supabase/server"

export type AlertSeverity = "info" | "warning" | "critical"

export interface Alert {
  type: string
  severity: AlertSeverity
  title: string
  description: string
  action_url: string
}

export async function getActiveAlerts(): Promise<Alert[]> {
  const supabase = await createClient()
  const alerts: Alert[] = []
  const now = new Date()

  // ── 1. Contacts with followup_due tag ──────────────────────────────────────
  const { data: followupContacts } = await supabase
    .from("contacts")
    .select("id")
    .contains("tags", ["followup_due"])

  if (followupContacts && followupContacts.length > 0) {
    const n = followupContacts.length
    alerts.push({
      type: "followup_due",
      severity: "warning",
      title: `${n} contact${n > 1 ? "s" : ""} due for follow-up`,
      description: "Contacts that haven't replied after 7+ days are flagged for a follow-up email.",
      action_url: "/crm?filter=followup_due",
    })
  }

  // ── 2. Overdue invoices ────────────────────────────────────────────────────
  const { data: overdueInvoices } = await supabase
    .from("invoices")
    .select("id, total, due_at")
    .eq("status", "overdue")
    .order("due_at", { ascending: true })

  if (overdueInvoices && overdueInvoices.length > 0) {
    const oldest = overdueInvoices[0]
    const daysOld = oldest.due_at
      ? Math.floor((now.getTime() - new Date(oldest.due_at).getTime()) / 86400000)
      : 0
    const n = overdueInvoices.length
    alerts.push({
      type: "invoice_overdue",
      severity: daysOld > 30 ? "critical" : "warning",
      title: `${n} invoice${n > 1 ? "s" : ""} overdue`,
      description: `Oldest is ${daysOld} day${daysOld !== 1 ? "s" : ""} past due. Total outstanding unpaid.`,
      action_url: "/operations/invoices",
    })
  }

  // ── 3. Tours with archive_recommended status ───────────────────────────────
  const { count: archiveTours } = await supabase
    .from("tours")
    .select("id", { count: "exact", head: true })
    .eq("status", "archive_recommended")

  if (archiveTours && archiveTours > 0) {
    alerts.push({
      type: "archive_recommended",
      severity: "warning",
      title: `${archiveTours} tour${archiveTours > 1 ? "s" : ""} on sold listings`,
      description: "These tours are using Matterport slots but their listings have sold. Archive to free capacity.",
      action_url: "/operations/tours",
    })
  }

  // ── 4. Matterport slot usage >80% ─────────────────────────────────────────
  const [{ count: activeCount }, { data: slotSetting }] = await Promise.all([
    supabase.from("tours").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("settings").select("value").eq("key", "matterport_slot_limit").single(),
  ])

  const slotLimit = parseInt(slotSetting?.value ?? "25", 10)
  const activeTours = activeCount ?? 0
  const slotPct = Math.round((activeTours / slotLimit) * 100)

  if (activeTours > slotLimit * 0.8) {
    alerts.push({
      type: "slot_usage",
      severity: activeTours >= slotLimit ? "critical" : "warning",
      title: `Slot usage at ${slotPct}% — ${activeTours}/${slotLimit} active`,
      description: "Consider archiving tours on sold or inactive listings to free Matterport capacity.",
      action_url: "/operations/tours",
    })
  }

  // ── 5. No content scheduled in next 3 days ────────────────────────────────
  const in3Days = new Date(now)
  in3Days.setDate(now.getDate() + 3)

  const { count: upcomingContent } = await supabase
    .from("content_calendar")
    .select("id", { count: "exact", head: true })
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", in3Days.toISOString())
    .in("status", ["scheduled", "draft"])

  if (!upcomingContent || upcomingContent === 0) {
    const dayName = now.toLocaleDateString("en-CA", { weekday: "long" })
    alerts.push({
      type: "no_content_scheduled",
      severity: "info",
      title: "No content scheduled in the next 3 days",
      description: `Nothing is queued starting ${dayName}. Add posts to the content calendar.`,
      action_url: "/content",
    })
  }

  // ── 6. Tax threshold >$25K ────────────────────────────────────────────────
  const yearStart = `${now.getFullYear()}-01-01`
  const { data: revenueRows } = await supabase
    .from("revenue_events")
    .select("amount")
    .gte("date", yearStart)

  const ytdRevenue = (revenueRows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)

  if (ytdRevenue > 25000) {
    const { data: goalSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "monthly_revenue_goal")
      .single()
    const formatted = ytdRevenue.toLocaleString("fr-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    })
    alerts.push({
      type: "tax_threshold",
      severity: ytdRevenue > 28000 ? "critical" : "warning",
      title: `Revenue at ${formatted} of $30K GST/QST threshold`,
      description: "Register for GST/QST before crossing $30,000 in annual revenue.",
      action_url: "/operations/invoices",
    })
  }

  // ── 7. Cron job failures in last 24h ──────────────────────────────────────
  const yesterday = new Date(now.getTime() - 86400000).toISOString()

  const { data: failedJobs } = await supabase
    .from("cron_logs")
    .select("job_name, ran_at, result_summary")
    .eq("status", "error")
    .gte("ran_at", yesterday)
    .order("ran_at", { ascending: false })

  if (failedJobs && failedJobs.length > 0) {
    // Group by job_name, show unique failures
    const seen = new Set<string>()
    for (const job of failedJobs) {
      if (seen.has(job.job_name)) continue
      seen.add(job.job_name)
      const time = new Date(job.ran_at).toLocaleTimeString("fr-CA", {
        hour: "2-digit",
        minute: "2-digit",
      })
      alerts.push({
        type: "cron_failure",
        severity: "critical",
        title: `Cron job "${job.job_name}" failed`,
        description: `Failed at ${time}. Last error: ${job.result_summary?.slice(0, 80) ?? "unknown"}`,
        action_url: "/settings/cron",
      })
    }
  }

  // Sort: critical first, then warning, then info
  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => order[a.severity] - order[b.severity])

  return alerts
}
