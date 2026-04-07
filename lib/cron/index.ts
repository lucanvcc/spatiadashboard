import cron from "node-cron"
import { runListingMonitor } from "./listing-monitor"
import { runFollowupReminder } from "./followup-reminder"
import { runAnalyticsSnapshot } from "./analytics-snapshot"
import { runTourSlotCheck } from "./tour-slot-check"
import { runTaxThreshold } from "./tax-threshold"
import { runInvoiceOverdue } from "./invoice-overdue"
import { runWeeklyReport } from "./weekly-report"

// Prevent duplicate registration on hot-reload in dev
const globalForCron = globalThis as unknown as { __cronRegistered?: boolean }

export const CRON_JOBS: Record<string, { schedule: string; description: string; fn: () => Promise<string> }> = {
  "listing-monitor": {
    schedule: "0 2 * * *",
    description: "Check listing URLs for sold status (2:00 AM daily)",
    fn: runListingMonitor,
  },
  "followup-reminder": {
    schedule: "0 9 * * *",
    description: "Flag contacts due for follow-up (9:00 AM daily)",
    fn: runFollowupReminder,
  },
  "analytics-snapshot": {
    schedule: "59 23 * * *",
    description: "Aggregate daily metrics into analytics_daily (11:59 PM daily)",
    fn: runAnalyticsSnapshot,
  },
  "tour-slot-check": {
    schedule: "0 6 * * *",
    description: "Check Matterport slot usage vs limit (6:00 AM daily)",
    fn: runTourSlotCheck,
  },
  "tax-threshold": {
    schedule: "0 8 * * 1",
    description: "Check YTD revenue vs $30K GST/QST threshold (8:00 AM Mondays)",
    fn: runTaxThreshold,
  },
  "invoice-overdue": {
    schedule: "0 8 * * *",
    description: "Find and flag overdue unpaid invoices (8:00 AM daily)",
    fn: runInvoiceOverdue,
  },
  "weekly-report": {
    schedule: "0 7 * * 1",
    description: "Generate and store last week's report (7:00 AM Mondays)",
    fn: runWeeklyReport,
  },
}

export function registerCronJobs() {
  if (globalForCron.__cronRegistered) return
  globalForCron.__cronRegistered = true

  for (const [name, job] of Object.entries(CRON_JOBS)) {
    cron.schedule(job.schedule, async () => {
      // Check if job is enabled in settings
      try {
        const { createClient } = await import("@supabase/supabase-js")
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data } = await supabase
          .from("settings")
          .select("value")
          .eq("key", `cron_${name.replace(/-/g, "_")}_enabled`)
          .single()

        if (data?.value === "false") {
          console.log(`[cron] ${name} skipped (disabled)`)
          return
        }
      } catch {
        // If settings check fails, run anyway
      }

      await job.fn()
    })

    console.log(`[cron] registered: ${name} (${job.schedule})`)
  }

  console.log(`[cron] ${Object.keys(CRON_JOBS).length} jobs registered`)
}
