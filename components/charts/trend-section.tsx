"use client"

import { useEffect, useState } from "react"
import { RevenueSpendChart } from "./revenue-spend-chart"

interface DataPoint {
  date: string
  revenue: number
  spend: number
}

export function TrendSection() {
  const [data, setData] = useState<DataPoint[]>([])

  useEffect(() => {
    fetch("/api/dashboard/trend")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setData(d))
  }, [])

  return (
    <div className="border border-border bg-card p-5 space-y-3">
      <p className="spatia-label text-xs text-muted-foreground">revenue vs. spend — 30 days</p>
      <RevenueSpendChart data={data} />
    </div>
  )
}
