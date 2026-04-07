"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface Props {
  data: { source: string; amount: number }[]
}

const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#a78bfa", "#fbbf24", "#fb923c"]

export function RevenuePie({ data }: Props) {
  if (data.length === 0) return (
    <p className="text-sm text-muted-foreground py-8 text-center">no revenue data yet</p>
  )

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="amount" nameKey="source" cx="50%" cy="50%" outerRadius={80} labelLine={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontSize: 12 }}
          formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, undefined]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
