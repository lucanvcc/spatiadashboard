"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts"

interface DataPoint {
  date: string
  revenue: number
  spend: number
}

export function RevenueSpendChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">no data yet — add revenue events and ad spend to see the trend</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontSize: 12 }}
          formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, undefined]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={1.5} dot={false} name="revenue" />
        <Line type="monotone" dataKey="spend" stroke="#f87171" strokeWidth={1.5} dot={false} name="ad spend" />
      </LineChart>
    </ResponsiveContainer>
  )
}
