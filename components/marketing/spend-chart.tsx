"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts"

interface Props {
  data: { date: string; meta: number; google: number; instagram_promoted: number; other: number }[]
}

const CHANNELS = [
  { key: "meta", color: "#60a5fa" },
  { key: "google", color: "#34d399" },
  { key: "instagram_promoted", color: "#f472b6" },
  { key: "other", color: "#a78bfa" },
]

export function SpendChart({ data }: Props) {
  if (data.length === 0) return (
    <p className="text-sm text-muted-foreground py-8 text-center">no spend data yet</p>
  )

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontSize: 12 }}
          formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, undefined]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {CHANNELS.map((c) => (
          <Bar key={c.key} dataKey={c.key} stackId="a" fill={c.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
