import { runCronJob, getSupabaseAdmin } from "./run-job"

export async function runAnalyticsSnapshot() {
  return runCronJob("analytics-snapshot", async () => {
    const supabase = getSupabaseAdmin()

    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10) // YYYY-MM-DD
    const todayStart = `${todayStr}T00:00:00.000Z`
    const todayEnd = `${todayStr}T23:59:59.999Z`

    // Emails sent today
    const { count: emailsSent } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", todayStart)
      .lte("sent_at", todayEnd)
      .neq("status", "draft")

    // Emails opened today
    const { count: emailsOpened } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .gte("opened_at", todayStart)
      .lte("opened_at", todayEnd)

    // Emails replied today
    const { count: emailsReplied } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .gte("replied_at", todayStart)
      .lte("replied_at", todayEnd)

    // Shoots booked today
    const { count: shootsBooked } = await supabase
      .from("shoots")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd)

    // Shoots completed today (delivered)
    const { count: shootsCompleted } = await supabase
      .from("shoots")
      .select("*", { count: "exact", head: true })
      .gte("delivered_at", todayStart)
      .lte("delivered_at", todayEnd)

    // Revenue from revenue_events today
    const { data: revenueRows } = await supabase
      .from("revenue_events")
      .select("amount")
      .gte("date", todayStr)
      .lte("date", todayStr)

    const revenue = (revenueRows ?? []).reduce(
      (sum: number, r: { amount: number }) => sum + (r.amount ?? 0),
      0
    )

    // Ad spend today
    const { data: spendRows } = await supabase
      .from("marketing_spend")
      .select("amount_spent")
      .eq("date", todayStr)

    const adSpend = (spendRows ?? []).reduce(
      (sum: number, r: { amount_spent: number }) => sum + (r.amount_spent ?? 0),
      0
    )

    // Upsert analytics_daily row (in case job runs twice)
    const { error } = await supabase.from("analytics_daily").upsert(
      {
        date: todayStr,
        emails_sent: emailsSent ?? 0,
        emails_opened: emailsOpened ?? 0,
        replies: emailsReplied ?? 0,
        shoots_booked: (shootsBooked ?? 0) + (shootsCompleted ?? 0),
        revenue,
        ad_spend: adSpend,
      },
      { onConflict: "date" }
    )

    if (error) throw new Error(error.message)

    return `snapshot for ${todayStr}: ${emailsSent ?? 0} emails, ${shootsBooked ?? 0} shoots, $${revenue} revenue`
  })
}
