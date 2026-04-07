"use client"

import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface AnalyticsData {
  timeSeries: { date: string; sent: number; opened: number; replied: number }[]
  campaignStats: { id: string; name: string; sent: number; opened: number; replied: number; reply_rate: number; open_rate: number }[]
  funnel: { stage: string; count: number }[]
  totals: { sent: number; opened: number; replied: number; open_rate: number; reply_rate: number }
}

const CHART_STYLE = {
  tooltip: {
    contentStyle: {
      background: "oklch(0.12 0 0)",
      border: "1px solid oklch(1 0 0 / 8%)",
      borderRadius: "2px",
      fontSize: "12px",
      color: "oklch(0.94 0 0)",
    },
  },
  axis: { tick: { fill: "oklch(0.55 0 0)", fontSize: 11 }, axisLine: false, tickLine: false },
  grid: { stroke: "oklch(1 0 0 / 6%)", strokeDasharray: "3 3" },
}

export default function OutreachAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/outreach/analytics")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [])

  // Format date labels
  const seriesWithLabel = (data?.timeSeries ?? []).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("fr-CA", { month: "short", day: "numeric" }),
  }))

  // Show only every 5 days on x-axis
  const thinSeries = seriesWithLabel.filter((_, i) => i % 5 === 0 || i === seriesWithLabel.length - 1)

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/outreach" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="font-heading text-xl tracking-tight">outreach analytics</h1>
          <p className="text-xs text-muted-foreground">last 30 days</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-border bg-card p-5 h-20 animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">failed to load analytics</p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "emails sent", value: data.totals.sent.toString() },
              { label: "opened", value: data.totals.opened.toString() },
              { label: "replied", value: data.totals.replied.toString() },
              { label: "open rate", value: `${data.totals.open_rate}%` },
              { label: "reply rate", value: `${data.totals.reply_rate}%` },
            ].map(({ label, value }) => (
              <div key={label} className="border border-border bg-card p-4 space-y-1">
                <p className="spatia-label">{label}</p>
                <p className="font-heading text-2xl tracking-tight">{value}</p>
              </div>
            ))}
          </div>

          {/* Time series chart */}
          <div className="border border-border bg-card p-5 space-y-4">
            <p className="spatia-label">emails over time</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={seriesWithLabel} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid {...CHART_STYLE.grid} />
                <XAxis
                  dataKey="label"
                  {...CHART_STYLE.axis}
                  ticks={thinSeries.map((d) => d.label)}
                />
                <YAxis {...CHART_STYLE.axis} allowDecimals={false} />
                <Tooltip {...CHART_STYLE.tooltip} />
                <Line
                  type="monotone"
                  dataKey="sent"
                  stroke="oklch(0.72 0 0)"
                  strokeWidth={1.5}
                  dot={false}
                  name="sent"
                />
                <Line
                  type="monotone"
                  dataKey="opened"
                  stroke="oklch(0.52 0 0)"
                  strokeWidth={1.5}
                  dot={false}
                  name="opened"
                />
                <Line
                  type="monotone"
                  dataKey="replied"
                  stroke="oklch(0.94 0 0)"
                  strokeWidth={2}
                  dot={false}
                  name="replied"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4">
              {[
                { label: "sent", color: "oklch(0.72 0 0)" },
                { label: "opened", color: "oklch(0.52 0 0)" },
                { label: "replied", color: "oklch(0.94 0 0)" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-px" style={{ backgroundColor: color, height: 2 }} />
                  <span className="spatia-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Campaign reply rates */}
          {data.campaignStats.length > 0 && (
            <div className="border border-border bg-card p-5 space-y-4">
              <p className="spatia-label">reply rate by campaign</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={data.campaignStats}
                  margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                  layout="vertical"
                >
                  <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                  <XAxis type="number" {...CHART_STYLE.axis} domain={[0, 100]} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    {...CHART_STYLE.axis}
                    width={120}
                    tick={{ ...CHART_STYLE.axis.tick, fontSize: 10 }}
                  />
                  <Tooltip
                    {...CHART_STYLE.tooltip}
                    formatter={(v) => [`${v ?? 0}%`, "reply rate"]}
                  />
                  <Bar dataKey="reply_rate" fill="oklch(0.94 0 0)" radius={[0, 2, 2, 0]} name="reply rate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pipeline funnel */}
          <div className="border border-border bg-card p-5 space-y-4">
            <p className="spatia-label">pipeline funnel</p>
            <div className="flex items-end gap-2">
              {data.funnel.map(({ stage, count }, i) => {
                const maxCount = Math.max(...data.funnel.map((f) => f.count), 1)
                const height = Math.max((count / maxCount) * 120, 4)
                return (
                  <div key={stage} className="flex flex-col items-center gap-2 flex-1">
                    <p className="text-xs font-medium">{count}</p>
                    <div
                      className="w-full bg-foreground/10 border border-border/50 transition-all"
                      style={{ height, backgroundColor: i === data.funnel.length - 1 ? "oklch(0.94 0 0)" : undefined }}
                    />
                    <p className="spatia-label text-[9px] text-center leading-tight">{stage}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Campaign table */}
          {data.campaignStats.length > 0 && (
            <div className="border border-border bg-card p-5 space-y-3">
              <p className="spatia-label">campaigns ranked by reply rate</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 spatia-label font-normal">campaign</th>
                    <th className="text-right py-2 spatia-label font-normal">sent</th>
                    <th className="text-right py-2 spatia-label font-normal">opened</th>
                    <th className="text-right py-2 spatia-label font-normal">replied</th>
                    <th className="text-right py-2 spatia-label font-normal">reply rate</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.campaignStats]
                    .sort((a, b) => b.reply_rate - a.reply_rate)
                    .map((c) => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="py-2 text-sm truncate max-w-[200px]">{c.name}</td>
                        <td className="py-2 text-right text-muted-foreground">{c.sent}</td>
                        <td className="py-2 text-right text-muted-foreground">{c.opened}</td>
                        <td className="py-2 text-right text-muted-foreground">{c.replied}</td>
                        <td className="py-2 text-right font-medium">{c.reply_rate}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
