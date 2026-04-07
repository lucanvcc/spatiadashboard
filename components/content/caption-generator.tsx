"use client"

import { useState } from "react"
import type { ContentPillar } from "@/types"

const PILLARS: { key: ContentPillar; label: string }[] = [
  { key: "the_work", label: "the work" },
  { key: "the_edge", label: "the edge" },
  { key: "the_process", label: "the process" },
  { key: "the_proof", label: "the proof" },
  { key: "the_culture", label: "the culture" },
]

interface Props {
  pillar: ContentPillar
  onCaptions: (fr: string, en: string) => void
}

export function CaptionGenerator({ pillar, onCaptions }: Props) {
  const [topic, setTopic] = useState("")
  const [loading, setLoading] = useState(false)

  async function generate() {
    if (!topic.trim()) return
    setLoading(true)
    const res = await fetch("/api/ai/caption", {
      method: "POST",
      body: JSON.stringify({ pillar, topic }),
    })
    setLoading(false)
    if (res.ok) {
      const { caption_fr, caption_en } = await res.json()
      onCaptions(caption_fr, caption_en)
    }
  }

  return (
    <div className="flex gap-2">
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && generate()}
        placeholder="topic / context for this post..."
        className="flex-1 bg-background border border-border px-3 py-2 text-sm"
      />
      <button
        onClick={generate}
        disabled={loading || !topic.trim()}
        className="spatia-label text-xs px-4 py-2 border border-border hover:bg-accent transition-colors disabled:opacity-50"
      >
        {loading ? "drafting..." : "draft with ai"}
      </button>
    </div>
  )
}
