import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/pricing"
import { MoneyCharts } from "@/components/money/money-charts"
import { InvoiceAging, type AgingBucket } from "@/components/money/invoice-aging"
import Link from "next/link"

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getMoneyOverview() {
  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const quarter = Math.floor(month / 3)

  const startOfMonth = new Date(year, month, 1).toISOString().slice(0, 10)
  const startOfLastMonth = new Date(year, month - 1, 1).toISOString().slice(0, 10)
  const endOfLastMonth = new Date(year, month, 0).toISOString().slice(0, 10)
  const startOfQtr = new Date(year, quarter * 3, 1).toISOString().slice(0, 10)
  const startOfYear = `${year}-01-01`

  const [
    { data: paidInvoices },
    { data: lastMonthInvoices },
    { data: sentInvoices },
    { data: overdueInvoices },
    { data: expensesMtd },
    { data: recentInvoices },
    { data: monthlyData },
    { data: expensesByMonth },
  ] = await Promise.all([
    // Paid MTD/QTD/YTD
    supabase
      .from("invoices")
      .select("paid_at, total, contact_id")
      .eq("status", "paid")
      .gte("paid_at", startOfYear),

    // Last month paid
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", startOfLastMonth)
      .lte("paid_at", endOfLastMonth),

    // Outstanding (sent)
    supabase.from("invoices").select("total").eq("status", "sent"),

    // Overdue
    supabase.from("invoices").select("id, total, due_at, contacts(name)").eq("status", "overdue"),

    // Expenses MTD
    supabase
      .from("expenses")
      .select("amount")
      .gte("date", startOfMonth),

    // Recent invoices
    supabase
      .from("invoices")
      .select("id, wave_invoice_id, status, total, created_at, paid_at, due_at, contacts(name)")
      .order("created_at", { ascending: false })
      .limit(10),

    // Monthly revenue last 12 months — group in JS
    supabase
      .from("invoices")
      .select("paid_at, total, gst, qst")
      .eq("status", "paid")
      .gte("paid_at", new Date(year - 1, month + 1, 1).toISOString().slice(0, 10))
      .order("paid_at", { ascending: true }),

    // Monthly expenses last 12 months
    supabase
      .from("expenses")
      .select("date, amount")
      .gte("date", new Date(year - 1, month + 1, 1).toISOString().slice(0, 10))
      .order("date", { ascending: true }),
  ])

  // ── KPI aggregates ──────────────────────────────────────────────────────────
  const paid = paidInvoices ?? []
  const revenueMtd = paid
    .filter((i) => i.paid_at && i.paid_at.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`)
    .reduce((s, i) => s + i.total, 0)
  const revenueQtd = paid
    .filter((i) => i.paid_at && i.paid_at >= startOfQtr)
    .reduce((s, i) => s + i.total, 0)
  const revenueYtd = paid.reduce((s, i) => s + i.total, 0)
  const revenueLastMonth = (lastMonthInvoices ?? []).reduce((s, i) => s + i.total, 0)
  const revMtdPct =
    revenueLastMonth > 0
      ? Math.round(((revenueMtd - revenueLastMonth) / revenueLastMonth) * 100)
      : null

  const outstandingTotal = (sentInvoices ?? []).reduce((s, i) => s + i.total, 0)
  const overdueTotal = (overdueInvoices ?? []).reduce((s, i) => s + i.total, 0)
  const overdueCount = (overdueInvoices ?? []).length
  const expensesMtdTotal = (expensesMtd ?? []).reduce((s, e) => s + e.amount, 0)
  const netProfitMtd = revenueMtd - expensesMtdTotal

  // ── Invoice status counts ────────────────────────────────────────────────────
  const { data: statusCounts } = await supabase
    .from("invoices")
    .select("status")

  const statusBreakdown: Record<string, number> = {}
  for (const inv of statusCounts ?? []) {
    statusBreakdown[inv.status] = (statusBreakdown[inv.status] ?? 0) + 1
  }

  // ── Monthly chart data ───────────────────────────────────────────────────────
  const monthlyRevenue: Record<string, number> = {}
  const monthlyExpenses: Record<string, number> = {}

  for (const inv of monthlyData ?? []) {
    if (!inv.paid_at) continue
    const key = inv.paid_at.slice(0, 7)
    monthlyRevenue[key] = (monthlyRevenue[key] ?? 0) + inv.total
  }

  for (const exp of expensesByMonth ?? []) {
    const key = exp.date.slice(0, 7)
    monthlyExpenses[key] = (monthlyExpenses[key] ?? 0) + exp.amount
  }

  // Build last 12 months array
  const months: { month: string; revenue: number; expenses: number; profit: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const rev = monthlyRevenue[key] ?? 0
    const exp = monthlyExpenses[key] ?? 0
    months.push({ month: key, revenue: rev, expenses: exp, profit: rev - exp })
  }

  // ── Revenue by client ────────────────────────────────────────────────────────
  const clientRevenue: Record<string, number> = {}
  for (const inv of paid) {
    const cid = inv.contact_id as string | null
    if (cid) clientRevenue[cid] = (clientRevenue[cid] ?? 0) + inv.total
  }

  const { data: contactNames } = await supabase
    .from("contacts")
    .select("id, name")
    .in("id", Object.keys(clientRevenue).slice(0, 20))

  const contactNameMap: Record<string, string> = {}
  for (const c of contactNames ?? []) contactNameMap[c.id] = c.name

  const revenueByClient = Object.entries(clientRevenue)
    .map(([id, total]) => ({ name: contactNameMap[id] ?? "Unknown", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  return {
    revenueMtd,
    revenueQtd,
    revenueYtd,
    revMtdPct,
    outstandingTotal,
    overdueTotal,
    overdueCount,
    expensesMtdTotal,
    netProfitMtd,
    statusBreakdown,
    months,
    revenueByClient,
    recentInvoices: recentInvoices ?? [],
  }
}

async function getInvoiceAging() {
  const supabase = await createClient()

  // Get all paid invoices with their created_at and paid_at
  const { data: paidInvoices } = await supabase
    .from("invoices")
    .select("id, total, created_at, paid_at")
    .eq("status", "paid")
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: false })
    .limit(200)

  if (!paidInvoices || paidInvoices.length === 0) {
    return { buckets: [], avgDaysToPay: null, fastestDays: null, slowestDays: null }
  }

  // Calculate days to pay for each invoice
  const daysToPayList = paidInvoices
    .map((inv) => {
      const created = new Date(inv.created_at).getTime()
      const paid = new Date(inv.paid_at!).getTime()
      const days = Math.max(0, Math.round((paid - created) / 86400000))
      return { days, total: inv.total }
    })
    .filter((d) => d.days >= 0 && d.days < 365) // sanity filter

  if (daysToPayList.length === 0) {
    return { buckets: [], avgDaysToPay: null, fastestDays: null, slowestDays: null }
  }

  const avgDaysToPay = daysToPayList.reduce((s, d) => s + d.days, 0) / daysToPayList.length
  const fastestDays = Math.min(...daysToPayList.map((d) => d.days))
  const slowestDays = Math.max(...daysToPayList.map((d) => d.days))

  // Buckets: 0-3 days, 4-7 days, 8-14 days, 15-30 days, 31+ days
  const bucketDefs = [
    { label: "0–3 jours", min: 0, max: 3, color: "bg-emerald-400/70" },
    { label: "4–7 jours", min: 4, max: 7, color: "bg-emerald-400/40" },
    { label: "8–14 jours", min: 8, max: 14, color: "bg-amber-400/60" },
    { label: "15–30 jours", min: 15, max: 30, color: "bg-amber-400/40" },
    { label: "31+ jours", min: 31, max: 999, color: "bg-red-400/50" },
  ]

  const buckets: AgingBucket[] = bucketDefs.map((def) => {
    const matching = daysToPayList.filter((d) => d.days >= def.min && d.days <= def.max)
    return {
      label: def.label,
      count: matching.length,
      total: matching.reduce((s, d) => s + d.total, 0),
      color: def.color,
    }
  })

  return { buckets, avgDaysToPay, fastestDays, slowestDays }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: "red" | "amber" | "green" | null
}) {
  const valueColor =
    highlight === "red"
      ? "text-red-400"
      : highlight === "amber"
      ? "text-amber-400"
      : highlight === "green"
      ? "text-emerald-400"
      : ""
  return (
    <div className="border border-border bg-card p-5 space-y-2">
      <p className="spatia-label text-xs text-muted-foreground">{label}</p>
      <p className={`font-heading text-2xl tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  paid: "text-emerald-400",
  sent: "text-blue-400",
  overdue: "text-red-400",
  draft: "text-muted-foreground",
  cancelled: "text-muted-foreground",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MoneyPage() {
  const [data, aging] = await Promise.all([getMoneyOverview(), getInvoiceAging()])

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-heading text-xl tracking-tight">money</h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          revenue · expenses · invoices · taxes
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          label="revenue mtd"
          value={formatCurrency(data.revenueMtd)}
          sub={
            data.revMtdPct !== null
              ? `${data.revMtdPct >= 0 ? "▲" : "▼"} ${Math.abs(data.revMtdPct)}% vs last month`
              : "first month on record"
          }
          highlight={data.revMtdPct !== null ? (data.revMtdPct >= 0 ? "green" : "red") : null}
        />
        <StatCard label="revenue qtd" value={formatCurrency(data.revenueQtd)} />
        <StatCard label="revenue ytd" value={formatCurrency(data.revenueYtd)} />
        <StatCard
          label="outstanding"
          value={formatCurrency(data.outstandingTotal)}
          sub="unpaid sent invoices"
          highlight={data.outstandingTotal > 0 ? "amber" : null}
        />
        <StatCard
          label="overdue"
          value={formatCurrency(data.overdueTotal)}
          sub={data.overdueCount > 0 ? `${data.overdueCount} invoice${data.overdueCount > 1 ? "s" : ""}` : "none"}
          highlight={data.overdueCount > 0 ? "red" : null}
        />
        <StatCard
          label="net profit mtd"
          value={formatCurrency(data.netProfitMtd)}
          sub={`expenses: ${formatCurrency(data.expensesMtdTotal)}`}
          highlight={data.netProfitMtd >= 0 ? "green" : "red"}
        />
      </div>

      {/* Charts */}
      <MoneyCharts
        months={data.months}
        statusBreakdown={data.statusBreakdown}
        revenueByClient={data.revenueByClient}
      />

      {/* Invoice Aging Waterfall */}
      <div className="border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="spatia-label text-xs text-muted-foreground">vieillissement des factures</p>
          <p className="spatia-label text-[10px] text-muted-foreground">délai de création → paiement</p>
        </div>
        <InvoiceAging
          buckets={aging.buckets}
          avgDaysToPay={aging.avgDaysToPay}
          fastestDays={aging.fastestDays}
          slowestDays={aging.slowestDays}
        />
      </div>

      {/* Recent invoices */}
      <div className="border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="spatia-label text-xs text-muted-foreground">recent invoices</p>
          <Link
            href="/operations/invoices"
            className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            view all →
          </Link>
        </div>
        {data.recentInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">no invoices yet</p>
        ) : (
          <div className="divide-y divide-border">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {data.recentInvoices.map((inv: any) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm">{inv.contacts?.name ?? "—"}</p>
                    <span className={`spatia-label text-xs ${STATUS_COLORS[inv.status] ?? ""}`}>
                      {inv.status}
                    </span>
                    {inv.wave_invoice_id && (
                      <span className="spatia-label text-xs text-muted-foreground/60">
                        {inv.wave_invoice_id}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inv.paid_at
                      ? `paid ${new Date(inv.paid_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`
                      : inv.due_at
                      ? `due ${new Date(inv.due_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`
                      : new Date(inv.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <p className="font-heading text-base shrink-0">{formatCurrency(inv.total)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
