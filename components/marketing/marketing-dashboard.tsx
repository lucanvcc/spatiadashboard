"use client"

import { useState, useEffect, useCallback } from "react"
import { SpendChart } from "./spend-chart"
import { RevenuePie } from "./revenue-pie"
import { SpendForm } from "./spend-form"
import { AiRecommend } from "./ai-recommend"
import { formatCurrency } from "@/lib/pricing"

interface SpendRow {
  id: string
  date: string
  channel: string
  campaign_name: string | null
  amount_spent: number
  impressions: number | null
  clicks: number | null
  leads_generated: number | null
}

interface RevenueRow {
  source: string
  amount: number
}

export function MarketingDashboard() {
  const [spend, setSpend] = useState<SpendRow[]>([])
  const [revenue, setRevenue] = useState<RevenueRow[]>([])
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    const [sr, rr] = await Promise.all([
      fetch(`/api/marketing-spend?days=${days}`).then((r) => r.json()),
      fetch("/api/revenue-by-source").then((r) => r.json()),
    ])
    setSpend(Array.isArray(sr) ? sr : [])
    setRevenue(Array.isArray(rr) ? rr : [])
  }, [days])

  useEffect(() => { load() }, [load])

  // Aggregate spend by channel per week
  const channelTotals: Record<string, { spent: number; leads: number; clicks: number }> = {}
  for (const s of spend) {
    if (!channelTotals[s.channel]) channelTotals[s.channel] = { spent: 0, leads: 0, clicks: 0 }
    channelTotals[s.channel].spent += s.amount_spent
    channelTotals[s.channel].leads += s.leads_generated ?? 0
    channelTotals[s.channel].clicks += s.clicks ?? 0
  }
  const totalSpend = Object.values(channelTotals).reduce((s, c) => s + c.spent, 0)
  const totalLeads = Object.values(channelTotals).reduce((s, c) => s + c.leads, 0)

  // Build chart data grouped by date (last N days, weekly bins)
  const dateMap: Record<string, Record<string, number>> = {}
  for (const s of spend) {
    const week = s.date.slice(0, 7) // group by month for simplicity
    if (!dateMap[week]) dateMap[week] = { meta: 0, google: 0, instagram_promoted: 0, other: 0 }
    dateMap[week][s.channel] = (dateMap[week][s.channel] ?? 0) + s.amount_spent
  }
  const chartData = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals } as { date: string; meta: number; google: number; instagram_promoted: number; other: number }))

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header controls */}
      <div className="flex items-center gap-3">
        <SpendForm onCreated={load} />
        <div className="flex gap-1 ml-auto">
          {[30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`spatia-label text-xs px-3 py-1.5 border transition-colors ${
                days === d ? "border-foreground bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">total spend</p>
          <p className="font-heading text-xl">{formatCurrency(totalSpend)}</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">leads generated</p>
          <p className="font-heading text-xl">{totalLeads}</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">cost per lead</p>
          <p className="font-heading text-xl">{totalLeads > 0 ? formatCurrency(totalSpend / totalLeads) : "—"}</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">channels active</p>
          <p className="font-heading text-xl">{Object.keys(channelTotals).length}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="border border-border bg-card p-5 space-y-3">
          <p className="spatia-label text-xs text-muted-foreground">spend by channel</p>
          <SpendChart data={chartData} />
        </div>
        <div className="border border-border bg-card p-5 space-y-3">
          <p className="spatia-label text-xs text-muted-foreground">revenue by source</p>
          <RevenuePie data={revenue} />
        </div>
      </div>

      {/* Channel breakdown table */}
      {Object.keys(channelTotals).length > 0 && (
        <div className="border border-border bg-card">
          <div className="px-5 py-3 border-b border-border">
            <p className="spatia-label text-xs text-muted-foreground">channel comparison</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-2 spatia-label text-xs text-muted-foreground font-normal">channel</th>
                <th className="px-5 py-2 spatia-label text-xs text-muted-foreground font-normal">spent</th>
                <th className="px-5 py-2 spatia-label text-xs text-muted-foreground font-normal">leads</th>
                <th className="px-5 py-2 spatia-label text-xs text-muted-foreground font-normal">CPL</th>
                <th className="px-5 py-2 spatia-label text-xs text-muted-foreground font-normal">clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(channelTotals)
                .sort(([, a], [, b]) => b.spent - a.spent)
                .map(([ch, d]) => (
                  <tr key={ch}>
                    <td className="px-5 py-3">{ch}</td>
                    <td className="px-5 py-3">{formatCurrency(d.spent)}</td>
                    <td className="px-5 py-3">{d.leads}</td>
                    <td className="px-5 py-3">{d.leads > 0 ? formatCurrency(d.spent / d.leads) : "—"}</td>
                    <td className="px-5 py-3">{d.clicks}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Spend entries */}
      {spend.length > 0 && (
        <div className="border border-border bg-card">
          <div className="px-5 py-3 border-b border-border">
            <p className="spatia-label text-xs text-muted-foreground">recent entries</p>
          </div>
          <div className="divide-y divide-border">
            {spend.slice(0, 20).map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div className="space-y-0.5">
                  <p>{s.campaign_name ?? s.channel}</p>
                  <p className="text-xs text-muted-foreground">{s.date} · {s.channel}</p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="font-heading">{formatCurrency(s.amount_spent)}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.leads_generated != null ? `${s.leads_generated} leads` : ""}
                    {s.clicks != null ? ` · ${s.clicks} clicks` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI recommendation */}
      <AiRecommend />
    </div>
  )
}
