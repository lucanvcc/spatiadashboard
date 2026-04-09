import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/pricing"

async function getTaxData() {
  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const yearStart = `${year}-01-01`

  // YTD paid invoices
  const { data: ytdInvoices } = await supabase
    .from("invoices")
    .select("paid_at, total, subtotal, gst, qst")
    .eq("status", "paid")
    .gte("paid_at", yearStart)
    .order("paid_at", { ascending: true })

  // YTD expenses
  const { data: ytdExpenses } = await supabase
    .from("expenses")
    .select("date, amount, gst_paid, qst_paid")
    .gte("date", yearStart)
    .order("date", { ascending: true })

  // Tax snapshots
  const { data: snapshots } = await supabase
    .from("tax_summary_snapshots")
    .select("*")
    .gte("period_start", yearStart)
    .order("period_start", { ascending: false })
    .limit(24)

  const invoices = ytdInvoices ?? []
  const expenses = ytdExpenses ?? []

  const ytdRevenue = invoices.reduce((s, i) => s + (i.total ?? 0), 0)
  const ytdGstCollected = invoices.reduce((s, i) => s + (i.gst ?? 0), 0)
  const ytdQstCollected = invoices.reduce((s, i) => s + (i.qst ?? 0), 0)
  const ytdGstPaid = expenses.reduce((s, e) => s + (e.gst_paid ?? 0), 0)
  const ytdQstPaid = expenses.reduce((s, e) => s + (e.qst_paid ?? 0), 0)
  const netGstOwing = Math.max(0, ytdGstCollected - ytdGstPaid)
  const netQstOwing = Math.max(0, ytdQstCollected - ytdQstPaid)
  const thresholdPct = Math.min((ytdRevenue / 30000) * 100, 100)

  // Monthly breakdown
  const months: Record<
    string,
    { revenue: number; gst_collected: number; qst_collected: number; gst_paid: number; qst_paid: number }
  > = {}

  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`
    months[key] = { revenue: 0, gst_collected: 0, qst_collected: 0, gst_paid: 0, qst_paid: 0 }
  }

  for (const inv of invoices) {
    if (!inv.paid_at) continue
    const key = inv.paid_at.slice(0, 7)
    if (!months[key]) continue
    months[key].revenue += inv.total ?? 0
    months[key].gst_collected += inv.gst ?? 0
    months[key].qst_collected += inv.qst ?? 0
  }

  for (const exp of expenses) {
    const key = exp.date.slice(0, 7)
    if (!months[key]) continue
    months[key].gst_paid += exp.gst_paid ?? 0
    months[key].qst_paid += exp.qst_paid ?? 0
  }

  const monthlyRows = Object.entries(months)
    .filter(([, v]) => v.revenue > 0 || v.gst_collected > 0)
    .map(([month, v]) => ({
      month,
      ...v,
      net_gst: Math.max(0, v.gst_collected - v.gst_paid),
      net_qst: Math.max(0, v.qst_collected - v.qst_paid),
      total_liability: Math.max(0, v.gst_collected - v.gst_paid) + Math.max(0, v.qst_collected - v.qst_paid),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // Projected annual (simple linear extrapolation)
  const monthsElapsed = now.getMonth() + 1 + now.getDate() / 30
  const projectedAnnual = monthsElapsed > 0 ? (ytdRevenue / monthsElapsed) * 12 : 0

  return {
    ytdRevenue,
    ytdGstCollected,
    ytdQstCollected,
    ytdGstPaid,
    ytdQstPaid,
    netGstOwing,
    netQstOwing,
    thresholdPct,
    projectedAnnual,
    monthlyRows,
    snapshots: snapshots ?? [],
  }
}

export default async function TaxesPage() {
  const data = await getTaxData()

  const thresholdColor =
    data.thresholdPct >= 80
      ? "bg-red-400"
      : data.thresholdPct >= 60
      ? "bg-amber-400"
      : "bg-emerald-400"

  const thresholdStatus =
    data.thresholdPct >= 80
      ? "critical — register for GST/QST immediately"
      : data.thresholdPct >= 60
      ? "approaching threshold — monitor closely"
      : "below threshold — tracking"

  const thresholdStatusColor =
    data.thresholdPct >= 80
      ? "text-red-400"
      : data.thresholdPct >= 60
      ? "text-amber-400"
      : "text-emerald-400"

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-heading text-xl tracking-tight">taxes</h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          GST 5% · QST 9.975% · $30K threshold
        </p>
      </div>

      {/* $30K Threshold Widget */}
      <div className="border border-border bg-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="spatia-label text-xs text-muted-foreground mb-1">$30k gst/qst threshold</p>
            <p className="font-heading text-3xl tracking-tight">{formatCurrency(data.ytdRevenue)}</p>
            <p className={`spatia-label text-xs mt-1 ${thresholdStatusColor}`}>{thresholdStatus}</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-3xl tracking-tight">{data.thresholdPct.toFixed(1)}%</p>
            <p className="spatia-label text-xs text-muted-foreground mt-1">of $30,000</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-3 bg-border/40 overflow-hidden">
            <div
              className={`h-full transition-all ${thresholdColor}`}
              style={{ width: `${Math.min(data.thresholdPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>$0</span>
            <span className="text-amber-400/80">$25k — alert zone</span>
            <span className="text-red-400/80">$30k — register</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <p className="spatia-label text-xs text-muted-foreground">projected annual</p>
            <p className="font-heading text-lg">{formatCurrency(data.projectedAnnual)}</p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="spatia-label text-xs text-muted-foreground">remaining to threshold</p>
            <p className={`font-heading text-lg ${data.ytdRevenue >= 30000 ? "text-red-400" : ""}`}>
              {formatCurrency(Math.max(0, 30000 - data.ytdRevenue))}
            </p>
          </div>
        </div>
      </div>

      {/* YTD Tax Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">GST collected</p>
          <p className="font-heading text-xl">{formatCurrency(data.ytdGstCollected)}</p>
          <p className="text-xs text-muted-foreground">5% of revenue</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">QST collected</p>
          <p className="font-heading text-xl">{formatCurrency(data.ytdQstCollected)}</p>
          <p className="text-xs text-muted-foreground">9.975% of revenue</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">net GST owing</p>
          <p className={`font-heading text-xl ${data.netGstOwing > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {formatCurrency(data.netGstOwing)}
          </p>
          <p className="text-xs text-muted-foreground">after input credits</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">net QST owing</p>
          <p className={`font-heading text-xl ${data.netQstOwing > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {formatCurrency(data.netQstOwing)}
          </p>
          <p className="text-xs text-muted-foreground">after input credits</p>
        </div>
      </div>

      {/* Monthly breakdown table */}
      <div className="border border-border bg-card">
        <div className="p-5 border-b border-border">
          <p className="spatia-label text-xs text-muted-foreground">monthly tax breakdown — {new Date().getFullYear()}</p>
        </div>
        {data.monthlyRows.length === 0 ? (
          <div className="p-5 space-y-2">
            <p className="text-sm text-muted-foreground">aucune donnée fiscale — ajoutez des factures ou importez depuis Wave.</p>
            <div className="flex gap-3">
              <a href="/money/invoices" className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                ajouter une facture →
              </a>
              <a href="/money/import-wave" className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                import wave csv →
              </a>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["period", "revenue", "GST collected", "QST collected", "GST on expenses", "QST on expenses", "net GST", "net QST", "total liability"].map((h) => (
                    <th key={h} className="spatia-label text-muted-foreground text-left px-4 py-2 font-normal whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.monthlyRows.map((row) => (
                  <tr key={row.month} className="hover:bg-accent/20 transition-colors">
                    <td className="spatia-label px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(row.month + "-15").toLocaleDateString("en-CA", { month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCurrency(row.gst_collected)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCurrency(row.qst_collected)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatCurrency(row.gst_paid)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatCurrency(row.qst_paid)}</td>
                    <td className={`px-4 py-3 tabular-nums ${row.net_gst > 0 ? "text-amber-400" : ""}`}>
                      {formatCurrency(row.net_gst)}
                    </td>
                    <td className={`px-4 py-3 tabular-nums ${row.net_qst > 0 ? "text-amber-400" : ""}`}>
                      {formatCurrency(row.net_qst)}
                    </td>
                    <td className={`px-4 py-3 tabular-nums font-medium ${row.total_liability > 0 ? "text-amber-400" : ""}`}>
                      {formatCurrency(row.total_liability)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-border bg-accent/20">
                  <td className="spatia-label px-4 py-3 text-muted-foreground font-medium">totals</td>
                  <td className="px-4 py-3 tabular-nums font-medium">{formatCurrency(data.ytdRevenue)}</td>
                  <td className="px-4 py-3 tabular-nums font-medium">{formatCurrency(data.ytdGstCollected)}</td>
                  <td className="px-4 py-3 tabular-nums font-medium">{formatCurrency(data.ytdQstCollected)}</td>
                  <td className="px-4 py-3 tabular-nums font-medium text-muted-foreground">{formatCurrency(data.ytdGstPaid)}</td>
                  <td className="px-4 py-3 tabular-nums font-medium text-muted-foreground">{formatCurrency(data.ytdQstPaid)}</td>
                  <td className={`px-4 py-3 tabular-nums font-medium ${data.netGstOwing > 0 ? "text-amber-400" : ""}`}>
                    {formatCurrency(data.netGstOwing)}
                  </td>
                  <td className={`px-4 py-3 tabular-nums font-medium ${data.netQstOwing > 0 ? "text-amber-400" : ""}`}>
                    {formatCurrency(data.netQstOwing)}
                  </td>
                  <td className={`px-4 py-3 tabular-nums font-medium ${(data.netGstOwing + data.netQstOwing) > 0 ? "text-amber-400" : ""}`}>
                    {formatCurrency(data.netGstOwing + data.netQstOwing)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
