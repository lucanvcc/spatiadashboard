"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { CaptionGenerator } from "./caption-generator"
import type { ContentPillar, ContentStatus } from "@/types"

interface Post {
  id: string
  pillar: ContentPillar
  content_type: string
  caption_fr: string | null
  caption_en: string | null
  scheduled_at: string | null
  status: ContentStatus
  created_at: string
}

const PILLARS: { key: ContentPillar; label: string; color: string }[] = [
  { key: "the_work", label: "the work", color: "bg-blue-400/20 text-blue-400 border-blue-400/30" },
  { key: "the_edge", label: "the edge", color: "bg-yellow-400/20 text-yellow-400 border-yellow-400/30" },
  { key: "the_process", label: "the process", color: "bg-purple-400/20 text-purple-400 border-purple-400/30" },
  { key: "the_proof", label: "the proof", color: "bg-emerald-400/20 text-emerald-400 border-emerald-400/30" },
  { key: "the_culture", label: "the culture", color: "bg-pink-400/20 text-pink-400 border-pink-400/30" },
]

const STATUS_COLORS: Record<ContentStatus, string> = {
  draft: "text-muted-foreground",
  scheduled: "text-blue-400",
  posted: "text-emerald-400",
  analyzed: "text-purple-400",
}

function getPillar(key: ContentPillar) {
  return PILLARS.find((p) => p.key === key)!
}

function monthDays(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export function ContentCalendar() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [posts, setPosts] = useState<Post[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [form, setForm] = useState({ pillar: "the_work" as ContentPillar, content_type: "post", caption_fr: "", caption_en: "" })
  const [loading, setLoading] = useState(false)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`

  const load = useCallback(async () => {
    const res = await fetch(`/api/content?month=${monthStr}`)
    if (res.ok) setPosts(await res.json())
  }, [monthStr])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  const days = monthDays(year, month)
  const firstDay = firstDayOfMonth(year, month)

  const postsByDay: Record<number, Post[]> = {}
  for (const p of posts) {
    if (p.scheduled_at) {
      const d = new Date(p.scheduled_at).getDate()
      if (!postsByDay[d]) postsByDay[d] = []
      postsByDay[d].push(p)
    }
  }

  // Pillar balance
  const pillarCounts: Record<ContentPillar, number> = {
    the_work: 0, the_edge: 0, the_process: 0, the_proof: 0, the_culture: 0,
  }
  for (const p of posts) pillarCounts[p.pillar]++
  const totalPosts = posts.length

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (selectedDay === null) return
    setLoading(true)
    const scheduled_at = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}T12:00:00`
    const res = await fetch("/api/content", {
      method: "POST",
      body: JSON.stringify({ ...form, scheduled_at }),
    })
    setLoading(false)
    if (res.ok) { toast.success("Post added"); setAddOpen(false); setForm({ pillar: "the_work", content_type: "post", caption_fr: "", caption_en: "" }); load() }
    else { const j = await res.json(); toast.error(j.error ?? "Failed") }
  }

  async function advanceStatus(post: Post) {
    const order: ContentStatus[] = ["draft", "scheduled", "posted", "analyzed"]
    const next = order[order.indexOf(post.status) + 1]
    if (!next) return
    const updates: Record<string, unknown> = { id: post.id, status: next }
    if (next === "posted") updates.posted_at = new Date().toISOString()
    const res = await fetch("/api/content", { method: "PATCH", body: JSON.stringify(updates) })
    if (res.ok) { toast.success(`Status → ${next}`); load() }
  }

  async function deletePost(id: string) {
    const res = await fetch(`/api/content?id=${id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Post deleted"); setExpandedPost(null); load() }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Pillar balance */}
      <div className="border border-border bg-card p-4 space-y-3">
        <p className="spatia-label text-xs text-muted-foreground">pillar balance — {totalPosts} posts this month</p>
        <div className="flex gap-2 flex-wrap">
          {PILLARS.map((p) => {
            const count = pillarCounts[p.key]
            const pct = totalPosts > 0 ? Math.round((count / totalPosts) * 100) : 0
            return (
              <div key={p.key} className={`border px-3 py-1.5 space-y-0.5 ${p.color}`}>
                <p className="spatia-label text-xs">{p.label}</p>
                <p className="text-xs">{count} post{count !== 1 ? "s" : ""} · {pct}%</p>
              </div>
            )
          })}
        </div>
        {/* Missing pillar alert */}
        {totalPosts > 0 && PILLARS.some((p) => pillarCounts[p.key] === 0) && (
          <p className="text-xs text-amber-400">
            ⚠ missing: {PILLARS.filter((p) => pillarCounts[p.key] === 0).map((p) => p.label).join(", ")}
          </p>
        )}
      </div>

      {/* Calendar header */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="spatia-label text-xs px-3 py-1.5 border border-border hover:bg-accent transition-colors">←</button>
        <p className="spatia-label text-sm">
          {new Date(year, month).toLocaleDateString("en-CA", { month: "long", year: "numeric" })}
        </p>
        <button onClick={nextMonth} className="spatia-label text-xs px-3 py-1.5 border border-border hover:bg-accent transition-colors">→</button>
        <button onClick={() => setAddOpen(!addOpen)} className="spatia-label text-xs px-4 py-1.5 border border-border hover:bg-accent transition-colors ml-auto">
          + add post
        </button>
      </div>

      {/* Add form */}
      {addOpen && (
        <form onSubmit={handleAdd} className="border border-border bg-card p-5 space-y-4">
          <p className="spatia-label">new post</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="spatia-label text-xs text-muted-foreground">pillar</label>
              <select value={form.pillar} onChange={(e) => setForm(f => ({ ...f, pillar: e.target.value as ContentPillar }))} className="w-full bg-background border border-border px-3 py-2 text-sm">
                {PILLARS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="spatia-label text-xs text-muted-foreground">day</label>
              <select value={selectedDay ?? ""} onChange={(e) => setSelectedDay(Number(e.target.value))} required className="w-full bg-background border border-border px-3 py-2 text-sm">
                <option value="">select day</option>
                {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="spatia-label text-xs text-muted-foreground">format</label>
              <select value={form.content_type} onChange={(e) => setForm(f => ({ ...f, content_type: e.target.value }))} className="w-full bg-background border border-border px-3 py-2 text-sm">
                <option value="post">post</option>
                <option value="reel">reel</option>
                <option value="story">story</option>
                <option value="carousel">carousel</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="spatia-label text-xs text-muted-foreground">draft with ai</label>
            <CaptionGenerator
              pillar={form.pillar}
              onCaptions={(fr, en) => setForm(f => ({ ...f, caption_fr: fr, caption_en: en }))}
            />
          </div>
          <div className="space-y-1">
            <label className="spatia-label text-xs text-muted-foreground">caption (fr)</label>
            <textarea value={form.caption_fr} onChange={(e) => setForm(f => ({ ...f, caption_fr: e.target.value }))} rows={3} placeholder="Texte français..." className="w-full bg-background border border-border px-3 py-2 text-sm resize-none" />
          </div>
          <div className="space-y-1">
            <label className="spatia-label text-xs text-muted-foreground">caption (en)</label>
            <textarea value={form.caption_en} onChange={(e) => setForm(f => ({ ...f, caption_en: e.target.value }))} rows={3} placeholder="English text..." className="w-full bg-background border border-border px-3 py-2 text-sm resize-none" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="spatia-label px-4 py-2 bg-foreground text-background hover:opacity-80 text-sm disabled:opacity-50">
              {loading ? "saving..." : "save post"}
            </button>
            <button type="button" onClick={() => setAddOpen(false)} className="spatia-label px-4 py-2 border border-border hover:bg-accent text-sm">cancel</button>
          </div>
        </form>
      )}

      {/* Calendar grid */}
      <div className="border border-border">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center spatia-label text-xs text-muted-foreground border-r last:border-r-0 border-border">{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="border-r border-b border-border h-24 bg-accent/5" />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1
            const dayPosts = postsByDay[day] ?? []
            const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day
            return (
              <div
                key={day}
                className={`border-r border-b border-border h-24 p-1.5 overflow-hidden cursor-pointer hover:bg-accent/30 transition-colors ${isToday ? "bg-accent/20" : ""} ${(firstDay + i + 1) % 7 === 0 ? "border-r-0" : ""}`}
                onClick={() => { setSelectedDay(day); setAddOpen(true) }}
              >
                <p className={`spatia-label text-xs mb-1 ${isToday ? "text-foreground" : "text-muted-foreground"}`}>{day}</p>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map((p) => {
                    const pillar = getPillar(p.pillar)
                    return (
                      <div
                        key={p.id}
                        onClick={(e) => { e.stopPropagation(); setExpandedPost(expandedPost === p.id ? null : p.id) }}
                        className={`border px-1 py-0.5 truncate text-xs cursor-pointer ${pillar.color}`}
                      >
                        {pillar.label} · {p.content_type}
                      </div>
                    )
                  })}
                  {dayPosts.length > 3 && <p className="text-xs text-muted-foreground">+{dayPosts.length - 3}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Expanded post detail */}
      {expandedPost && (() => {
        const post = posts.find((p) => p.id === expandedPost)
        if (!post) return null
        const pillar = getPillar(post.pillar)
        return (
          <div className="border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`border px-2 py-0.5 spatia-label text-xs ${pillar.color}`}>{pillar.label}</span>
                <span className={`spatia-label text-xs ${STATUS_COLORS[post.status]}`}>{post.status}</span>
                <span className="spatia-label text-xs text-muted-foreground">{post.content_type}</span>
              </div>
              <div className="flex gap-2">
                {post.status !== "analyzed" && (
                  <button onClick={() => advanceStatus(post)} className="spatia-label text-xs px-3 py-1 border border-border hover:bg-accent transition-colors">
                    → {["draft", "scheduled", "posted", "analyzed"][["draft", "scheduled", "posted", "analyzed"].indexOf(post.status) + 1]}
                  </button>
                )}
                <button onClick={() => deletePost(post.id)} className="spatia-label text-xs px-3 py-1 border border-border text-muted-foreground hover:text-red-400 transition-colors">delete</button>
                <button onClick={() => setExpandedPost(null)} className="spatia-label text-xs px-3 py-1 border border-border hover:bg-accent transition-colors">close</button>
              </div>
            </div>
            {post.caption_fr && (
              <div className="space-y-1">
                <p className="spatia-label text-xs text-muted-foreground">français</p>
                <p className="text-sm whitespace-pre-wrap">{post.caption_fr}</p>
              </div>
            )}
            {post.caption_en && (
              <div className="space-y-1">
                <p className="spatia-label text-xs text-muted-foreground">english</p>
                <p className="text-sm whitespace-pre-wrap">{post.caption_en}</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* List view */}
      {posts.length > 0 && (
        <div className="border border-border bg-card">
          <div className="px-5 py-3 border-b border-border">
            <p className="spatia-label text-xs text-muted-foreground">all posts this month</p>
          </div>
          <div className="divide-y divide-border">
            {posts.map((p) => {
              const pillar = getPillar(p.pillar)
              return (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <span className={`border px-2 py-0.5 spatia-label text-xs shrink-0 ${pillar.color}`}>{pillar.label}</span>
                  <p className="text-sm text-muted-foreground shrink-0">
                    {p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : "unscheduled"}
                  </p>
                  <p className="text-sm truncate flex-1">{p.caption_fr ?? p.caption_en ?? "no caption"}</p>
                  <span className={`spatia-label text-xs shrink-0 ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
