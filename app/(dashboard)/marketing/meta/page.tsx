import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/pricing"
import Link from "next/link"
import { BarChart2, Upload } from "lucide-react"

async function getMetaData() {
  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const startOfMonth = new Date(year, month, 1).toISOString().slice(0, 10)
  const startOfLastMonth = new Date(year, month - 1, 1).toISOString().slice(0, 10)
  const endOfLastMonth = new Date(year, month, 0).toISOString().slice(0, 10)
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: spendMtd },
    { data: spendLastMonth },
    { data: spendHistory },
    { data: campaigns },
    { data: adMetrics },
  ] = await Promise.all([
    // Meta spend this month
    supabase
      .from("marketing_spend")
      .select("amount_spent, impressions, clicks, leads_generated, date, campaign_name")
      .eq("channel", "meta")
      .gte("date", startOfMonth)
      .order("date", { ascending: false }),

    // Meta spend last month
    supabase
      .from("marketing_spend")
      .select("amount_spent, leads_generated")
      .eq("channel", "meta")
      .gte("date", startOfLastMonth)
      .lte("date", endOfLastMonth),

    // 90-day history for chart
    supabase
      .from("marketing_spend")
      .select("date, amount_spent, impressions, clicks, leads_generated, campaign_name")
      .eq("channel", "meta")
      .gte("date", last90)
      .order("date", { ascending: true }),

    // Ad campaigns from ad_campaigns table
    supabase
      .from("ad_campaigns")
      .select("id, name, status, objective, budget_daily, budget_total, start_date, end_date")
      .order("start_date", { ascending: false })
      .limit(20),

    // Ad metrics (last 90 days, aggregated by campaign)
    supabase
      .from("ad_metrics")
      .select("ad_campaign_id, date, impressions, clicks, spend, leads, conversions, cpm, cpc, cpl, roas")
      .gte("date", last90)
      .order("date", { ascending: false }),
  ])

  // ── Aggregate MTD ──────────────────────────────────────────────────────────
  const mtdSpend = (spendMtd ?? []).reduce((s, r) => s + r.amount_spent, 0)
  const mtdImpressions = (spendMtd ?? []).reduce((s, r) => s + (r.impressions ?? 0), 0)
  const mtdClicks = (spendMtd ?? []).reduce((s, r) => s + (r.clicks ?? 0), 0)
  const mtdLeads = (spendMtd ?? []).reduce((s, r) => s + (r.leads_generated ?? 0), 0)
  const lastMonthSpend = (spendLastMonth ?? []).reduce((s, r) => s + r.amount_spent, 0)
  const lastMonthLeads = (spendLastMonth ?? []).reduce((s, r) => s + (r.leads_generated ?? 0), 0)

  const ctr = mtdImpressions > 0 ? (mtdClicks / mtdImpressions) * 100 : 0
  const cpl = mtdLeads > 0 ? mtdSpend / mtdLeads : null
  const lastMonthCpl = lastMonthLeads > 0 ? lastMonthSpend / lastMonthLeads : null

  // ── Monthly chart (group by month) ────────────────────────────────────────
  const byMonth: Record<string, { spend: number; leads: number; impressions: number }> = {}
  for (const r of spendHistory ?? []) {
    const key = r.date.slice(0, 7)
    if (!byMonth[key]) byMonth[key] = { spend: 0, leads: 0, impressions: 0 }
    byMonth[key].spend += r.amount_spent
    byMonth[key].leads += r.leads_generated ?? 0
    byMonth[key].impressions += r.impressions ?? 0
  }
  const chartRows = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))

  // ── Campaign-level metrics from ad_metrics ────────────────────────────────
  const campaignMetricsMap: Record<
    string,
    { spend: number; impressions: number; clicks: number; leads: number; conversions: number }
  > = {}
  for (const m of adMetrics ?? []) {
    const id = m.ad_campaign_id
    if (!campaignMetricsMap[id]) {
      campaignMetricsMap[id] = { spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0 }
    }
    campaignMetricsMap[id].spend += m.spend ?? 0
    campaignMetricsMap[id].impressions += m.impressions ?? 0
    campaignMetricsMap[id].clicks += m.clicks ?? 0
    campaignMetricsMap[id].leads += m.leads ?? 0
    campaignMetricsMap[id].conversions += m.conversions ?? 0
  }

  return {
    mtdSpend,
    mtdImpressions,
    mtdClicks,
    mtdLeads,
    lastMonthSpend,
    ctr,
    cpl,
    lastMonthCpl,
    chartRows,
    campaigns: campaigns ?? [],
    campaignMetricsMap,
    recentEntries: (spendMtd ?? []).slice(0, 15),
  }
}

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
    <div className="border border-border bg-card p-4 space-y-1.5">
      <p className="spatia-label text-xs text-muted-foreground">{label}</p>
      <p className={`font-heading text-xl tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400",
  paused: "text-amber-400",
  completed: "text-muted-foreground",
  draft: "text-muted-foreground",
}

export default async function MetaAdsPage() {
  const data = await getMetaData()

  const spendDelta =
    data.lastMonthSpend > 0
      ? Math.round(((data.mtdSpend - data.lastMonthSpend) / data.lastMonthSpend) * 100)
      : null

  const maxChartSpend = Math.max(...data.chartRows.map((r) => r.spend), 1)

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-xl tracking-tight">meta ads</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            spend · campaigns · cost per lead · attribution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/marketing/meta/organic"
            className="flex items-center gap-1.5 text-xs border border-border px-3 py-2 hover:bg-accent transition-colors"
          >
            <BarChart2 size={12} strokeWidth={1.5} />
            organic
          </Link>
          <Link
            href="/marketing/meta-import"
            className="flex items-center gap-1.5 text-xs border border-border px-3 py-2 hover:bg-accent transition-colors"
          >
            <Upload size={12} strokeWidth={1.5} />
            import
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="spend mtd"
          value={formatCurrency(data.mtdSpend)}
          sub={
            spendDelta !== null
              ? `${spendDelta >= 0 ? "▲" : "▼"} ${Math.abs(spendDelta)}% vs last month`
              : "first month on record"
          }
          highlight={spendDelta !== null ? (spendDelta > 20 ? "amber" : null) : null}
        />
        <StatCard
          label="impressions mtd"
          value={
            data.mtdImpressions >= 1000
              ? `${(data.mtdImpressions / 1000).toFixed(1)}k`
              : data.mtdImpressions.toString()
          }
          sub={`${data.ctr.toFixed(2)}% CTR`}
        />
        <StatCard
          label="clicks mtd"
          value={data.mtdClicks.toString()}
          sub={
            data.mtdImpressions > 0
              ? `${((data.mtdClicks / data.mtdImpressions) * 100).toFixed(2)}% click-through`
              : "no impressions yet"
          }
        />
        <StatCard
          label="cost per lead"
          value={data.cpl !== null ? formatCurrency(data.cpl) : "—"}
          sub={
            data.lastMonthCpl !== null
              ? `last month: ${formatCurrency(data.lastMonthCpl)}`
              : `${data.mtdLeads} leads this month`
          }
          highlight={
            data.cpl !== null && data.lastMonthCpl !== null
              ? data.cpl < data.lastMonthCpl
                ? "green"
                : data.cpl > data.lastMonthCpl * 1.2
                ? "amber"
                : null
              : null
          }
        />
      </div>

      {/* Spend history bar chart (CSS-only) */}
      {data.chartRows.length > 0 && (
        <div className="border border-border bg-card p-5 space-y-4">
          <p className="spatia-label text-xs text-muted-foreground">spend history — 90 days</p>
          <div className="flex items-end gap-1 h-24">
            {data.chartRows.map((row) => (
              <div key={row.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div
                  className="w-full bg-foreground/20 hover:bg-foreground/40 transition-colors"
                  style={{ height: `${Math.max((row.spend / maxChartSpend) * 88, 2)}px` }}
                  title={`${row.month}: ${formatCurrency(row.spend)} · ${row.leads} leads`}
                />
                <p className="spatia-label text-[9px] text-muted-foreground/60 truncate w-full text-center">
                  {row.month.slice(5)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaigns from ad_campaigns table */}
      {data.campaigns.length > 0 && (
        <div className="border border-border bg-card">
          <div className="px-5 py-3 border-b border-border">
            <p className="spatia-label text-xs text-muted-foreground">campaigns</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["campaign", "status", "objective", "budget/day", "spend (90d)", "leads", "CPL"].map((h) => (
                    <th key={h} className="spatia-label text-xs text-muted-foreground font-normal px-5 py-2 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.campaigns.map((c) => {
                  const m = data.campaignMetricsMap[c.id]
                  const cpl = m && m.leads > 0 ? m.spend / m.leads : null
                  return (
                    <tr key={c.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-5 py-3 max-w-[200px] truncate">{c.name}</td>
                      <td className={`px-5 py-3 spatia-label text-xs ${STATUS_COLORS[c.status] ?? ""}`}>
                        {c.status}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{c.objective ?? "—"}</td>
                      <td className="px-5 py-3 tabular-nums">
                        {c.budget_daily != null ? formatCurrency(c.budget_daily) : "—"}
                      </td>
                      <td className="px-5 py-3 tabular-nums">{m ? formatCurrency(m.spend) : "—"}</td>
                      <td className="px-5 py-3 tabular-nums">{m ? m.leads : "—"}</td>
                      <td className={`px-5 py-3 tabular-nums ${cpl !== null && cpl > 100 ? "text-amber-400" : ""}`}>
                        {cpl !== null ? formatCurrency(cpl) : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent spend entries */}
      {data.recentEntries.length > 0 && (
        <div className="border border-border bg-card">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <p className="spatia-label text-xs text-muted-foreground">recent entries — this month</p>
            <Link
              href="/marketing/meta-import"
              className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              import more →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {data.recentEntries.map((e, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                <div className="space-y-0.5 min-w-0">
                  <p className="truncate">{e.campaign_name ?? "meta ads"}</p>
                  <p className="text-xs text-muted-foreground">{e.date}</p>
                </div>
                <div className="text-right space-y-0.5 shrink-0">
                  <p className="font-heading">{formatCurrency(e.amount_spent)}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.leads_generated != null ? `${e.leads_generated} leads` : ""}
                    {e.clicks != null ? ` · ${e.clicks} clicks` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.recentEntries.length === 0 && data.campaigns.length === 0 && (
        <div className="border border-border bg-card p-10 text-center space-y-3">
          <p className="text-muted-foreground text-sm">no meta ads data yet</p>
          <Link
            href="/marketing/meta-import"
            className="inline-flex items-center gap-1.5 text-xs border border-border px-3 py-2 hover:bg-accent transition-colors"
          >
            <Upload size={12} strokeWidth={1.5} />
            import from meta ads manager
          </Link>
        </div>
      )}
    </div>
  )
}
