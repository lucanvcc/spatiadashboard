"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

const MATTERPORT_PLAN_SLOTS = 25 // user can update this

interface Tour {
  id: string
  matterport_id: string
  title: string | null
  status: "active" | "archived"
  views: number
  listing_id: string | null
  archived_at: string | null
  created_at: string
  shoots: { address: string; contacts: { name: string } | null } | null
}

export function ToursManager() {
  const [tours, setTours] = useState<Tour[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch("/api/tours")
    if (res.ok) setTours(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  const active = tours.filter((t) => t.status === "active")
  const archived = tours.filter((t) => t.status === "archived")
  const onSold = active.filter((t) => t.listing_id) // tours linked to a listing (assume sold detection elsewhere)
  const slotPct = Math.round((active.length / MATTERPORT_PLAN_SLOTS) * 100)

  async function archiveTour(id: string) {
    const res = await fetch("/api/tours", {
      method: "PATCH",
      body: JSON.stringify({ id, status: "archived" }),
    })
    if (res.ok) { toast.success("Tour archived — slot freed"); load() }
    else toast.error("Failed")
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const res = await fetch("/api/tours", {
      method: "POST",
      body: JSON.stringify({
        matterport_id: fd.get("matterport_id"),
        title: fd.get("title") || null,
      }),
    })
    setLoading(false)
    if (res.ok) { toast.success("Tour added"); setAddOpen(false); load() }
    else { const j = await res.json(); toast.error(j.error ?? "Failed") }
  }

  const displayed = showArchived ? tours : active

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Slot gauge */}
      <div className="border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="spatia-label text-xs text-muted-foreground">slot utilization</p>
          <p className="spatia-label text-xs">{active.length} / {MATTERPORT_PLAN_SLOTS}</p>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full transition-all rounded-full ${slotPct >= 90 ? "bg-red-500" : slotPct >= 70 ? "bg-amber-400" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(slotPct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{slotPct}% full</p>
      </div>

      {/* Alerts */}
      {onSold.length > 0 && (
        <div className="border border-amber-400/30 bg-amber-400/5 p-4 space-y-2">
          <p className="spatia-label text-xs text-amber-400">⚠ {onSold.length} tour{onSold.length > 1 ? "s" : ""} on sold listings — archive to free slots?</p>
          {onSold.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm">
              <span>{t.title ?? t.matterport_id}</span>
              <button onClick={() => archiveTour(t.id)} className="spatia-label text-xs px-3 py-1 border border-amber-400/50 text-amber-400 hover:bg-amber-400/10 transition-colors">
                archive
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {addOpen ? (
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input name="matterport_id" required placeholder="Matterport model ID" className="bg-background border border-border px-3 py-2 text-sm w-52" />
            <input name="title" placeholder="Title (optional)" className="bg-background border border-border px-3 py-2 text-sm w-44" />
            <button type="submit" disabled={loading} className="spatia-label text-xs px-3 py-2 bg-foreground text-background disabled:opacity-50">
              {loading ? "saving..." : "add"}
            </button>
            <button type="button" onClick={() => setAddOpen(false)} className="spatia-label text-xs px-3 py-2 border border-border">cancel</button>
          </form>
        ) : (
          <button onClick={() => setAddOpen(true)} className="spatia-label px-4 py-2 border border-border hover:bg-accent transition-colors text-sm">
            + add tour
          </button>
        )}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showArchived ? "hide archived" : `show archived (${archived.length})`}
        </button>
      </div>

      {/* Tours list */}
      {displayed.length === 0 ? (
        <p className="text-muted-foreground text-sm">no tours yet</p>
      ) : (
        <div className="border border-border divide-y divide-border">
          {displayed.map((tour) => (
            <div key={tour.id} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{tour.title ?? tour.matterport_id}</p>
                  <span className={`spatia-label text-xs px-1.5 py-0.5 ${
                    tour.status === "active" ? "text-emerald-400" : "text-muted-foreground"
                  }`}>
                    {tour.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tour.shoots?.address ?? "—"}{tour.shoots?.contacts?.name ? ` · ${tour.shoots.contacts.name}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tour.views.toLocaleString()} views · ID: {tour.matterport_id}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`https://my.matterport.com/show/?m=${tour.matterport_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="spatia-label text-xs px-3 py-1 border border-border hover:bg-accent transition-colors"
                >
                  view ↗
                </a>
                {tour.status === "active" && (
                  <button
                    onClick={() => archiveTour(tour.id)}
                    className="spatia-label text-xs px-3 py-1 border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
