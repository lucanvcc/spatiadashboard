"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Printer,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { formatCurrency } from "@/lib/pricing"

interface ReportData {
  week: string
  week_number: number
  year: number
  date_range: { start: string; end: string }
  revenue: {
    total: number
    vs_last_week_pct: number | null
    mtd: number
    goal: number
    goal_pct: number | null
  }
  outreach: {
    emails_sent: number
    opened: number
    replied: number
    reply_rate: number
    reply_rate_vs_last_week: number
    pipeline_snapshot: Record<string, number>
  }
  shoots: {
    completed: number
    vs_last_week: number
    avg_delivery_hours: number
    slot_usage_pct: number
    slot_active: number
    slot_limit: number
  }
  marketing: {
    total_spend: number
    spend_by_channel: { channel: string; amount: number }[]
    cost_per_lead_by_channel: { channel: string; cost_per_lead: number | null; leads: number }[]
    best_channel: string | null
    worst_channel: string | null
  }
  content: {
    posts_published: number
    pillar_distribution: Record<string, number>
    total_engagement: number
  }
  financial?: {
    revenue_week: number
    expenses_week: number
    net_profit_week: number
    outstanding_total: number
    overdue_total: number
    gst_collected_mtd: number
    qst_collected_mtd: number
    ytd_revenue: number
    threshold_30k_pct: number
  }
  alerts: {
    type: string
    severity: "info" | "warning" | "critical"
    title: string
    description: string
    action_url: string
  }[]
  daily_sparklines: {
    revenue: { date: string; value: number }[]
    emails_sent: { date: string; value: number }[]
    ad_spend: { date: string; value: number }[]
  }
}

function Sparkline({ data }: { data: { date: string; value: number }[] }) {
  if (!data || data.length === 0) return <div className="h-8 text-muted-foreground/30 text-xs">no data</div>
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 bg-foreground/20 hover:bg-foreground/40 transition-colors rounded-sm min-h-[2px]"
          style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }}
          title={`${d.date}: ${d.value}`}
        />
      ))}
    </div>
  )
}

function TrendBadge({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>
  const positive = invert ? value < 0 : value > 0
  const color = value === 0 ? "text-muted-foreground" : positive ? "text-emerald-400" : "text-red-400"
  const Icon = value > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon size={11} strokeWidth={1.5} />
      {value > 0 ? "+" : ""}{value}%
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 print:break-inside-avoid">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <p className="spatia-label text-xs text-muted-foreground uppercase tracking-widest shrink-0">{title}</p>
        <div className="h-px flex-1 bg-border" />
      </div>
      {children}
    </div>
  )
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: React.ReactNode
}) {
  return (
    <div className="border border-border bg-card p-4 space-y-1">
      <p className="spatia-label text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-xl tracking-tight">{value}</p>
      {sub && <div className="text-xs">{sub}</div>}
    </div>
  )
}

const severityIcon = {
  critical: <AlertCircle size={13} strokeWidth={1.5} className="text-red-400 shrink-0" />,
  warning: <AlertTriangle size={13} strokeWidth={1.5} className="text-amber-400 shrink-0" />,
  info: <Info size={13} strokeWidth={1.5} className="text-blue-400 shrink-0" />,
}

function getAdjacentWeek(week: string, delta: number): string {
  const [year, num] = week.split("-").map(Number)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1) + (num - 1) * 7)
  weekStart.setUTCDate(weekStart.getUTCDate() + delta * 7)

  // Recalculate ISO week for new date
  const d = new Date(weekStart)
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const wNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-${String(wNum).padStart(2, "0")}`
}

export function WeeklyReportView({ week }: { week?: string }) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentWeek, setCurrentWeek] = useState(week ?? "")

  useEffect(() => {
    setLoading(true)
    const url = currentWeek ? `/api/reports/weekly?week=${currentWeek}` : "/api/reports/weekly"
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
        setCurrentWeek(d.week)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [currentWeek])

  if (loading) return <div className="text-muted-foreground text-sm animate-pulse">loading report...</div>
  if (error) return <div className="text-red-400 text-sm">{error}</div>
  if (!data) return null

  const prevWeek = getAdjacentWeek(data.week, -1)
  const nextWeek = getAdjacentWeek(data.week, 1)
  const isCurrentWeek = !week || week === data.week

  const pipelineEntries = [
    { label: "new lead", key: "new_lead" },
    { label: "emailed", key: "first_email_sent" },
    { label: "replied", key: "replied" },
    { label: "client", key: "booked" },
    { label: "churned", key: "churned" },
  ]
  const maxPipeline = Math.max(...pipelineEntries.map((e) => data.outreach.pipeline_snapshot[e.key] ?? 0), 1)

  const pillarLabels: Record<string, string> = {
    the_work: "the work",
    the_edge: "the edge",
    the_process: "the process",
    the_proof: "the proof",
    the_culture: "the culture",
  }

  return (
    <div className="space-y-6 max-w-4xl print:space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/reports" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← all reports
            </Link>
          </div>
          <h1 className="font-heading text-xl tracking-tight">
            week {data.week_number} — {data.year}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date(data.date_range.start + "T12:00:00Z").toLocaleDateString("fr-CA", {
              month: "long",
              day: "numeric",
            })}{" "}
            –{" "}
            {new Date(data.date_range.end + "T12:00:00Z").toLocaleDateString("fr-CA", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {isCurrentWeek && (
              <span className="ml-2 text-xs text-emerald-400 font-mono">[live]</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeek(prevWeek)}
            className="p-1.5 border border-border hover:bg-muted/30 transition-colors rounded-sm"
            title="previous week"
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setCurrentWeek(nextWeek)}
            className="p-1.5 border border-border hover:bg-muted/30 transition-colors rounded-sm"
            title="next week"
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-muted/30 transition-colors rounded-sm text-xs"
          >
            <Printer size={12} strokeWidth={1.5} />
            print
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block">
        <p className="font-heading text-lg">spatia — weekly report W{data.week_number} {data.year}</p>
        <p className="text-sm text-muted-foreground">
          {data.date_range.start} – {data.date_range.end}
        </p>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <Section title="actions needed">
          <div className="space-y-2">
            {data.alerts.map((alert, i) => (
              <Link
                key={i}
                href={alert.action_url}
                className="flex items-start gap-3 border border-border bg-card p-3 hover:bg-accent/20 transition-colors group print:no-underline"
              >
                {severityIcon[alert.severity]}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium group-hover:text-foreground">{alert.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Revenue */}
      <Section title="revenue">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox
            label="week total"
            value={formatCurrency(data.revenue.total)}
            sub={<TrendBadge value={data.revenue.vs_last_week_pct} />}
          />
          <StatBox
            label="month to date"
            value={formatCurrency(data.revenue.mtd)}
            sub={
              data.revenue.goal_pct !== null ? (
                <span className="text-muted-foreground">{data.revenue.goal_pct}% of goal</span>
              ) : undefined
            }
          />
          <StatBox
            label="monthly goal"
            value={formatCurrency(data.revenue.goal)}
          />
          <div className="border border-border bg-card p-4 space-y-2">
            <p className="spatia-label text-xs text-muted-foreground">revenue trend</p>
            <Sparkline data={data.daily_sparklines.revenue} />
          </div>
        </div>
        {data.revenue.goal_pct !== null && (
          <div className="border border-border bg-card p-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>monthly goal progress</span>
              <span>{data.revenue.goal_pct}%</span>
            </div>
            <div className="h-2 bg-border/40">
              <div
                className="h-full bg-foreground/40 transition-all"
                style={{ width: `${Math.min(data.revenue.goal_pct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </Section>

      {/* Outreach */}
      <Section title="outreach">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="emails sent" value={String(data.outreach.emails_sent)} />
          <StatBox label="opened" value={String(data.outreach.opened)} />
          <StatBox label="replied" value={String(data.outreach.replied)} />
          <StatBox
            label="reply rate"
            value={`${data.outreach.reply_rate}%`}
            sub={
              <span
                className={
                  data.outreach.reply_rate_vs_last_week >= 0 ? "text-emerald-400" : "text-red-400"
                }
              >
                {data.outreach.reply_rate_vs_last_week >= 0 ? "+" : ""}
                {data.outreach.reply_rate_vs_last_week}pp vs last week
              </span>
            }
          />
        </div>

        {/* Pipeline snapshot */}
        <div className="border border-border bg-card p-4 space-y-3">
          <p className="spatia-label text-xs text-muted-foreground">pipeline snapshot</p>
          <div className="space-y-2">
            {pipelineEntries.map((e) => {
              const count = data.outreach.pipeline_snapshot[e.key] ?? 0
              return (
                <div key={e.key} className="flex items-center gap-3">
                  <p className="spatia-label text-xs text-muted-foreground w-24 shrink-0">{e.label}</p>
                  <div className="flex-1 h-4 bg-border/30">
                    <div
                      className="h-full bg-foreground/25 transition-all"
                      style={{ width: `${(count / maxPipeline) * 100}%` }}
                    />
                  </div>
                  <p className="spatia-label text-xs w-6 text-right tabular-nums">{count}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* Shoots */}
      <Section title="shoots & operations">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox
            label="completed"
            value={String(data.shoots.completed)}
            sub={
              data.shoots.vs_last_week !== 0 ? (
                <span className={data.shoots.vs_last_week > 0 ? "text-emerald-400" : "text-red-400"}>
                  {data.shoots.vs_last_week > 0 ? "+" : ""}{data.shoots.vs_last_week} vs last week
                </span>
              ) : (
                <span className="text-muted-foreground">same as last week</span>
              )
            }
          />
          <StatBox
            label="avg delivery"
            value={data.shoots.avg_delivery_hours > 0 ? `${data.shoots.avg_delivery_hours}h` : "—"}
          />
          <StatBox
            label="matterport slots"
            value={`${data.shoots.slot_active}/${data.shoots.slot_limit}`}
            sub={
              <span className={data.shoots.slot_usage_pct > 80 ? "text-amber-400" : "text-muted-foreground"}>
                {data.shoots.slot_usage_pct}% used
              </span>
            }
          />
          <div className="border border-border bg-card p-4 space-y-2">
            <p className="spatia-label text-xs text-muted-foreground">slot capacity</p>
            <div className="h-2 bg-border/40 mt-3">
              <div
                className={`h-full transition-all ${
                  data.shoots.slot_usage_pct >= 100
                    ? "bg-red-500"
                    : data.shoots.slot_usage_pct > 80
                    ? "bg-amber-400"
                    : "bg-foreground/40"
                }`}
                style={{ width: `${Math.min(data.shoots.slot_usage_pct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{data.shoots.slot_usage_pct}% of {data.shoots.slot_limit}</p>
          </div>
        </div>
      </Section>

      {/* Marketing */}
      <Section title="marketing & spend">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatBox label="total spend" value={formatCurrency(data.marketing.total_spend)} />
          <StatBox
            label="best channel"
            value={data.marketing.best_channel ?? "—"}
            sub={<span className="text-emerald-400">lowest cost per lead</span>}
          />
          <StatBox
            label="worst channel"
            value={data.marketing.worst_channel ?? "—"}
            sub={<span className="text-red-400">highest cost per lead</span>}
          />
        </div>

        {data.marketing.spend_by_channel.length > 0 && (
          <div className="border border-border bg-card p-4 space-y-3">
            <p className="spatia-label text-xs text-muted-foreground">spend by channel</p>
            {data.marketing.spend_by_channel.map((c) => {
              const maxSpend = Math.max(...data.marketing.spend_by_channel.map((x) => x.amount), 1)
              const cpl = data.marketing.cost_per_lead_by_channel.find((x) => x.channel === c.channel)
              return (
                <div key={c.channel} className="flex items-center gap-3">
                  <p className="spatia-label text-xs text-muted-foreground w-28 shrink-0 capitalize">
                    {c.channel.replace("_", " ")}
                  </p>
                  <div className="flex-1 h-4 bg-border/30">
                    <div
                      className="h-full bg-foreground/25 transition-all"
                      style={{ width: `${(c.amount / maxSpend) * 100}%` }}
                    />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="spatia-label text-xs tabular-nums">${c.amount.toFixed(0)}</p>
                    {cpl && (
                      <p className="text-xs text-muted-foreground/60">
                        ${cpl.cost_per_lead}/lead
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Financial Health */}
      {data.financial && (
        <Section title="financial health">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox
              label="revenue this week"
              value={formatCurrency(data.financial.revenue_week)}
            />
            <StatBox
              label="expenses this week"
              value={formatCurrency(data.financial.expenses_week)}
            />
            <StatBox
              label="net profit"
              value={formatCurrency(data.financial.net_profit_week)}
              sub={
                <span
                  className={
                    data.financial.net_profit_week >= 0 ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {data.financial.net_profit_week >= 0 ? "profitable" : "at a loss"}
                </span>
              }
            />
            <StatBox
              label="outstanding"
              value={formatCurrency(data.financial.outstanding_total)}
              sub={
                data.financial.overdue_total > 0 ? (
                  <span className="text-red-400">
                    {formatCurrency(data.financial.overdue_total)} overdue
                  </span>
                ) : (
                  <span className="text-muted-foreground">none overdue</span>
                )
              }
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatBox
              label="ytd revenue"
              value={formatCurrency(data.financial.ytd_revenue)}
            />
            <StatBox
              label="GST collected ytd"
              value={formatCurrency(data.financial.gst_collected_mtd)}
            />
            <StatBox
              label="QST collected ytd"
              value={formatCurrency(data.financial.qst_collected_mtd)}
            />
          </div>
          <div className="border border-border bg-card p-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$30k gst/qst threshold</span>
              <span>{data.financial.threshold_30k_pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-border/40">
              <div
                className={`h-full transition-all ${
                  data.financial.threshold_30k_pct >= 80
                    ? "bg-red-400"
                    : data.financial.threshold_30k_pct >= 60
                    ? "bg-amber-400"
                    : "bg-foreground/40"
                }`}
                style={{ width: `${Math.min(data.financial.threshold_30k_pct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(data.financial.ytd_revenue)} of $30,000 —{" "}
              <a href="/money/taxes" className="hover:underline">
                view tax tracker →
              </a>
            </p>
          </div>
        </Section>
      )}

      {/* Content */}
      <Section title="content">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatBox label="posts published" value={String(data.content.posts_published)} />
          <StatBox label="total engagement" value={String(data.content.total_engagement)} />
          <StatBox
            label="avg per post"
            value={
              data.content.posts_published > 0
                ? String(Math.round(data.content.total_engagement / data.content.posts_published))
                : "—"
            }
          />
        </div>

        {Object.keys(data.content.pillar_distribution).length > 0 && (
          <div className="border border-border bg-card p-4 space-y-3">
            <p className="spatia-label text-xs text-muted-foreground">pillar distribution</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(data.content.pillar_distribution).map(([pillar, count]) => (
                <div key={pillar} className="border border-border px-2 py-1 text-xs">
                  <span className="text-muted-foreground">{pillarLabels[pillar] ?? pillar}</span>
                  <span className="ml-2 font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Footer */}
      <div className="border-t border-border pt-4 text-xs text-muted-foreground/50 text-right print:block hidden">
        spatia growth command center — week {data.week_number} {data.year}
      </div>
    </div>
  )
}
