import { runCronJob, getSupabaseAdmin } from "./run-job"
import { upsertActionItem } from "@/lib/action-items"

export async function runTaxThreshold() {
  return runCronJob("tax-threshold", async () => {
    const supabase = getSupabaseAdmin()

    const now = new Date()
    const year = now.getFullYear()
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const dayOfWeek = now.getDay() || 7
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - (dayOfWeek - 1))
    const weekStartStr = weekStart.toISOString().slice(0, 10)
    const todayStr = now.toISOString().slice(0, 10)

    const { data: invoiceRows, error: invErr } = await supabase
      .from("invoices")
      .select("total, gst, qst, paid_at")
      .eq("status", "paid")
      .gte("paid_at", yearStart)
      .lte("paid_at", `${yearEnd}T23:59:59Z`)

    if (invErr) throw new Error(invErr.message)

    const ytdRevenue = (invoiceRows ?? []).reduce(
      (sum: number, r: { total: number }) => sum + (r.total ?? 0), 0
    )
    const ytdGstCollected = (invoiceRows ?? []).reduce(
      (sum: number, r: { gst: number }) => sum + (r.gst ?? 0), 0
    )
    const ytdQstCollected = (invoiceRows ?? []).reduce(
      (sum: number, r: { qst: number }) => sum + (r.qst ?? 0), 0
    )

    const { data: revenueRows } = await supabase
      .from("revenue_events")
      .select("amount")
      .gte("date", yearStart)
      .lte("date", yearEnd)
      .is("invoice_id", null)

    const revenueEventsTotal = (revenueRows ?? []).reduce(
      (sum: number, r: { amount: number }) => sum + (r.amount ?? 0), 0
    )

    const totalRevenue = ytdRevenue + revenueEventsTotal

    const { data: expenseRows } = await supabase
      .from("expenses")
      .select("amount, gst_paid, qst_paid")
      .gte("date", yearStart)
      .lte("date", yearEnd)

    const ytdGstPaid = (expenseRows ?? []).reduce(
      (sum: number, r: { gst_paid: number }) => sum + (r.gst_paid ?? 0), 0
    )
    const ytdQstPaid = (expenseRows ?? []).reduce(
      (sum: number, r: { qst_paid: number }) => sum + (r.qst_paid ?? 0), 0
    )

    const netGstOwing = Math.max(0, ytdGstCollected - ytdGstPaid)
    const netQstOwing = Math.max(0, ytdQstCollected - ytdQstPaid)
    const thresholdPct = Math.min((totalRevenue / 30000) * 100, 100)

    await supabase.from("tax_summary_snapshots").insert({
      period_start: weekStartStr,
      period_end: todayStr,
      total_revenue: ytdRevenue,
      gst_collected: ytdGstCollected,
      qst_collected: ytdQstCollected,
      gst_paid: ytdGstPaid,
      qst_paid: ytdQstPaid,
      net_gst_owing: netGstOwing,
      net_qst_owing: netQstOwing,
      cumulative_ytd_revenue: totalRevenue,
      threshold_30k_pct: thresholdPct,
      snapshot_type: "weekly",
    })

    let actionItemsCreated = 0

    if (totalRevenue > 30000 * 0.6) {
      let severity: "info" | "warning" | "critical" = "info"
      if (thresholdPct >= 95) severity = "critical"
      else if (thresholdPct >= 80) severity = "warning"

      const formatted = totalRevenue.toLocaleString("fr-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      })

      const created = await upsertActionItem({
        type: "tax_threshold",
        severity,
        title: `Seuil fiscal: ${thresholdPct.toFixed(0)}% du 30 000$`,
        description: `Revenu YTD: ${formatted}. Inscription TPS/TVQ requise à 30 000$.`,
        related_entity_type: null,
        related_entity_id: null,
        related_url: "/money/taxes",
        source: "cron:tax_threshold",
        data: { ytd_revenue: totalRevenue, threshold: 30000, percentage: thresholdPct },
      })
      if (created) actionItemsCreated++

      // Legacy alert
      if (totalRevenue > 25000) {
        const { data: existing } = await supabase
          .from("alerts")
          .select("id")
          .eq("type", "tax_threshold")
          .eq("dismissed", false)
          .limit(1)

        if (!existing || existing.length === 0) {
          await supabase.from("alerts").insert({
            type: "tax_threshold",
            message: `Approaching $30K GST/QST threshold — YTD revenue: ${formatted}. Register for GST/QST before crossing $30,000.`,
            severity: totalRevenue > 28000 ? "critical" : "warning",
          })
        }
      }

      return {
        summary: `YTD revenue $${totalRevenue.toFixed(2)} (${thresholdPct.toFixed(1)}% of $30K) — alert created, snapshot saved`,
        actionItemsCreated,
      }
    }

    return {
      summary: `YTD revenue $${totalRevenue.toFixed(2)} (${thresholdPct.toFixed(1)}% of $30K) — below alert threshold, snapshot saved`,
      actionItemsCreated: 0,
    }
  })
}
