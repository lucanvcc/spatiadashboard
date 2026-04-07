import { runCronJob, getSupabaseAdmin } from "./run-job"
import { upsertActionItem } from "@/lib/action-items"

export async function runInvoiceOverdue() {
  return runCronJob("invoice-overdue", async () => {
    const supabase = getSupabaseAdmin()

    const now = new Date().toISOString()

    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("id, contact_id, total, due_at, status, wave_invoice_id, contacts(name)")
      .not("status", "eq", "paid")
      .not("status", "eq", "cancelled")
      .lt("due_at", now)
      .not("due_at", "is", null)

    if (error) throw new Error(error.message)
    if (!invoices || invoices.length === 0) {
      return { summary: "no overdue invoices", actionItemsCreated: 0 }
    }

    let updated = 0
    let actionItemsCreated = 0

    for (const invoice of invoices) {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(invoice.due_at).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (invoice.status !== "overdue") {
        await supabase
          .from("invoices")
          .update({ status: "overdue" })
          .eq("id", invoice.id)
        updated++
      }

      const invoiceLabel = invoice.wave_invoice_id ?? invoice.id.slice(0, 8)
      const contactName =
        invoice.contacts && typeof invoice.contacts === "object" && !Array.isArray(invoice.contacts)
          ? (invoice.contacts as { name: string }).name
          : null

      const created = await upsertActionItem({
        type: "invoice_overdue",
        severity: daysOverdue > 14 ? "critical" : "warning",
        title: `Facture en retard: #${invoiceLabel}`,
        description: `${contactName ? `${contactName} — ` : ""}$${invoice.total} dû depuis ${daysOverdue} jour${daysOverdue !== 1 ? "s" : ""}.`,
        related_entity_type: "invoice",
        related_entity_id: invoice.id,
        related_url: `/money/invoices/${invoice.id}`,
        source: "cron:invoice_overdue",
        data: {
          contact_name: contactName,
          amount: invoice.total,
          due_date: invoice.due_at,
          days_overdue: daysOverdue,
        },
      })
      if (created) actionItemsCreated++

      // Legacy alert (keep for backwards compat with home dashboard)
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

    return {
      summary: `${invoices.length} overdue invoice${invoices.length !== 1 ? "s" : ""} found, ${updated} status updated, ${actionItemsCreated} action items created`,
      actionItemsCreated,
    }
  })
}
