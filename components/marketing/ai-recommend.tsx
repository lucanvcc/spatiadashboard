"use client"

import { useState } from "react"

export function AiRecommend() {
  const [rec, setRec] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetch_() {
    setLoading(true)
    const res = await fetch("/api/ai/recommend")
    setLoading(false)
    if (res.ok) {
      const j = await res.json()
      setRec(j.recommendation)
    }
  }

  return (
    <div className="border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="spatia-label text-xs text-muted-foreground">ai budget recommendation</p>
        <button
          onClick={fetch_}
          disabled={loading}
          className="spatia-label text-xs px-3 py-1 border border-border hover:bg-accent transition-colors disabled:opacity-50"
        >
          {loading ? "thinking..." : rec ? "refresh" : "generate"}
        </button>
      </div>
      {rec ? (
        <p className="text-sm leading-relaxed">{rec}</p>
      ) : (
        <p className="text-sm text-muted-foreground">click generate to get a budget recommendation based on your 30-day data</p>
      )}
    </div>
  )
}
