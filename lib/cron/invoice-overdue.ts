import { runCronJob, getSupabaseAdmin } from "./run-job"

export async function runInvoiceOverdue() {
  return runCronJob("invoice-overdue", async () => {
    const supabase = getSupabaseAdmin()

    const now = new Date().toISOString()

    // Find unpaid invoices past due date
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("id, contact_id, total, due_at, status")
      .not("status", "eq", "paid")
      .not("status", "eq", "cancelled")
      .lt("due_at", now)
      .not("due_at", "is", null)

    if (error) throw new Error(error.message)
    if (!invoices || invoices.length === 0) return "no overdue invoices"

    let updated = 0

    for (const invoice of invoices) {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(invoice.due_at).getTime()) / (1000 * 60 * 60 * 24)
      )

      // Update status to overdue if not already
      if (invoice.status !== "overdue") {
        await supabase
          .from("invoices")
          .update({ status: "overdue" })
          .eq("id", invoice.id)
        updated++
      }

      // Create alert if not already exists for this invoice
      const { data: existing } = await supabase
        .from("alerts")
        .select("id")
        .eq("type", "invoice_overdue")
        .ilike("message", `%${invoice.id}%`)
        .eq("dismissed", false)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from("alerts").insert({
          type: "invoice_overdue",
          message: `Invoice ${invoice.id.slice(0, 8)} — $${invoice.total} — ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue.`,
          severity: daysOverdue > 30 ? "critical" : "warning",
        })
      }
    }

    return `${invoices.length} overdue invoice${invoices.length !== 1 ? "s" : ""} found, ${updated} status updated`
  })
}
