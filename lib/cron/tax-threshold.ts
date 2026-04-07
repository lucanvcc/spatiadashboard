import { runCronJob, getSupabaseAdmin } from "./run-job"

export async function runTaxThreshold() {
  return runCronJob("tax-threshold", async () => {
    const supabase = getSupabaseAdmin()

    const year = new Date().getFullYear()
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    // Sum all revenue_events for current year
    const { data: rows, error } = await supabase
      .from("revenue_events")
      .select("amount")
      .gte("date", yearStart)
      .lte("date", yearEnd)

    if (error) throw new Error(error.message)

    const total = (rows ?? []).reduce(
      (sum: number, r: { amount: number }) => sum + (r.amount ?? 0),
      0
    )

    if (total > 25000) {
      // Check for existing unresolved tax alert this year
      const { data: existing } = await supabase
        .from("alerts")
        .select("id")
        .eq("type", "tax_threshold")
        .eq("dismissed", false)
        .limit(1)

      if (!existing || existing.length === 0) {
        const formatted = total.toLocaleString("fr-CA", {
          style: "currency",
          currency: "CAD",
          maximumFractionDigits: 0,
        })
        await supabase.from("alerts").insert({
          type: "tax_threshold",
          message: `Approaching $30K GST/QST threshold — YTD revenue: ${formatted}. Register for GST/QST before crossing $30,000.`,
          severity: total > 28000 ? "critical" : "warning",
        })
      }

      return `YTD revenue $${total.toFixed(2)} — alert created`
    }

    return `YTD revenue $${total.toFixed(2)} — below $25K threshold`
  })
}
