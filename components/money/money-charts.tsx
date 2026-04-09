"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface MonthData {
  month: string
  revenue: number
  expenses: number
  profit: number
}

interface ClientRevenue {
  name: string
  total: number
}

interface Props {
  months: MonthData[]
  statusBreakdown: Record<string, number>
  revenueByClient: ClientRevenue[]
}

const CHART_COLORS = {
  revenue: "hsl(var(--foreground) / 0.7)",
  expenses: "hsl(var(--muted-foreground) / 0.4)",
  paid: "#34d399",
  sent: "#60a5fa",
  overdue: "#f87171",
  draft: "hsl(var(--muted-foreground) / 0.3)",
  cancelled: "hsl(var(--muted-foreground) / 0.15)",
}

function formatMonth(key: string): string {
  const [y, m] = key.split("-")
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("en-CA", {
    month: "short",
    year: "2-digit",
  })
}

function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border px-3 py-2 text-xs space-y-1">
      <p className="spatia-label text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

export function MoneyCharts({ months, statusBreakdown, revenueByClient }: Props) {
  const statusData = Object.entries(statusBreakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v }))

  const statusColorMap: Record<string, string> = {
    paid: CHART_COLORS.paid,
    sent: CHART_COLORS.sent,
    overdue: CHART_COLORS.overdue,
    draft: CHART_COLORS.draft,
    cancelled: CHART_COLORS.cancelled,
  }

  const hasRevData = months.some((m) => m.revenue > 0 || m.expenses > 0)
  const hasClientData = revenueByClient.length > 0
  const hasStatusData = statusData.length > 0

  return (
    <div className="space-y-4">
      {/* Revenue vs Expenses */}
      <div className="border border-border bg-card p-5 space-y-4">
        <p className="spatia-label text-xs text-muted-foreground">revenue vs expenses — 12 months</p>
        {hasRevData ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={months} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmt}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="revenue" fill={CHART_COLORS.revenue} radius={[2, 2, 0, 0]} />
              <Bar dataKey="expenses" name="expenses" fill={CHART_COLORS.expenses} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-muted-foreground text-sm">no data yet — import Wave CSV to populate</p>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Invoice status donut */}
        <div className="border border-border bg-card p-5 space-y-4">
          <p className="spatia-label text-xs text-muted-foreground">invoice status breakdown</p>
          {hasStatusData ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                  >
                    {statusData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={statusColorMap[entry.name] ?? "#888"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]
                      return (
                        <div className="bg-card border border-border px-2 py-1 text-xs">
                          {d.name}: {d.value}
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: statusColorMap[s.name] ?? "#888" }}
                    />
                    <span className="spatia-label text-xs text-muted-foreground capitalize">{s.name}</span>
                    <span className="spatia-label text-xs tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[140px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">no invoices</p>
            </div>
          )}
        </div>

        {/* Revenue by client */}
        <div className="border border-border bg-card p-5 space-y-4">
          <p className="spatia-label text-xs text-muted-foreground">revenue by client — top 10</p>
          {hasClientData ? (
            <div className="space-y-2">
              {revenueByClient.map((c) => {
                const max = revenueByClient[0].total
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <p className="spatia-label text-xs text-muted-foreground truncate w-28 shrink-0">
                      {c.name}
                    </p>
                    <div className="flex-1 h-4 bg-border/30">
                      <div
                        className="h-full bg-foreground/25 transition-all"
                        style={{ width: `${(c.total / max) * 100}%` }}
                      />
                    </div>
                    <p className="spatia-label text-xs tabular-nums shrink-0">{fmt(c.total)}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="h-[140px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">no paid invoices yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
