"use client"

import { useEffect, useState, useRef } from "react"
import { Trophy, ChevronLeft, ChevronRight } from "lucide-react"

interface Win {
  label: string
  value: string
  emoji: string
}

interface WeeklyWinsProps {
  wins: Win[]
}

export function WeeklyWins({ wins }: WeeklyWinsProps) {
  const [idx, setIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (wins.length <= 1) return
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % wins.length)
    }, 4000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [wins.length])

  if (wins.length === 0) return null

  const win = wins[idx]

  function prev() {
    setIdx((i) => (i - 1 + wins.length) % wins.length)
    if (timerRef.current) clearInterval(timerRef.current)
  }
  function next() {
    setIdx((i) => (i + 1) % wins.length)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  return (
    <div className="border border-emerald-400/20 bg-emerald-400/5 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy size={11} strokeWidth={1.5} className="text-emerald-400/70" />
          <p className="spatia-label text-[10px] text-emerald-400/70 uppercase tracking-widest">victoires cette semaine</p>
        </div>
        {wins.length > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={prev} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <ChevronLeft size={11} strokeWidth={2} />
            </button>
            <span className="font-mono text-[9px] text-muted-foreground/40">{idx + 1}/{wins.length}</span>
            <button onClick={next} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <ChevronRight size={11} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-base leading-none">{win.emoji}</span>
        <span className="font-mono text-lg text-emerald-400">{win.value}</span>
        <span className="spatia-label text-xs text-muted-foreground">{win.label}</span>
      </div>
    </div>
  )
}
