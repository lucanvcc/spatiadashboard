"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

type EventType = "shoot" | "call" | "post" | "meeting" | "task" | "other"
type EventSource = "event" | "shoot" | "post"

interface CalEvent {
  id: string
  raw_id: string
  type: EventType
  title: string
  starts_at: string
  ends_at: string | null
  all_day: boolean
  description: string | null
  location: string | null
  contact: string | null
  completed: boolean
  source: EventSource
}

interface Contact {
  id: string
  name: string
}

const TYPE_STYLES: Record<EventType, { dot: string; badge: string; label: string; emoji: string }> = {
  shoot:   { dot: "bg-blue-400",    badge: "bg-blue-400/15 text-blue-400 border-blue-400/30",    label: "shoot",   emoji: "📷" },
  call:    { dot: "bg-emerald-400", badge: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30", label: "call", emoji: "📞" },
  meeting: { dot: "bg-yellow-400",  badge: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",  label: "meeting", emoji: "🤝" },
  post:    { dot: "bg-pink-400",    badge: "bg-pink-400/15 text-pink-400 border-pink-400/30",    label: "post",    emoji: "📱" },
  task:    { dot: "bg-purple-400",  badge: "bg-purple-400/15 text-purple-400 border-purple-400/30",  label: "task",  emoji: "✓" },
  other:   { dot: "bg-zinc-400",    badge: "bg-zinc-400/15 text-zinc-400 border-zinc-400/30",    label: "event",   emoji: "📅" },
}

function fmt(iso: string, allDay: boolean) {
  if (allDay) return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
  return new Date(iso).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: true })
}

function monthRange(year: number, month: number) {
  const from = new Date(year, month, 1).toISOString()
  const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  return { from, to }
}

export function UnifiedCalendar({ contacts }: { contacts: Contact[] }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [events, setEvents] = useState<CalEvent[]>([])
  const [selected, setSelected] = useState<number | null>(null) // day number
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: "", event_type: "call" as EventType, starts_at: "", ends_at: "", all_day: false, description: "", location: "", contact_id: "" })
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<CalEvent | null>(null)

  const load = useCallback(async () => {
    const { from, to } = monthRange(year, month)
    const res = await fetch(`/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    if (res.ok) setEvents(await res.json())
  }, [year, month])

  useEffect(() => { load() }, [load])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()

  // Group events by day
  const byDay: Record<number, CalEvent[]> = {}
  for (const e of events) {
    const d = new Date(e.starts_at)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(e)
    }
  }

  const selectedEvents = selected ? (byDay[selected] ?? []) : []

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelected(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelected(null)
  }

  function openAdd(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    setForm(f => ({ ...f, starts_at: `${dateStr}T09:00`, ends_at: `${dateStr}T10:00` }))
    setSelected(day)
    setAdding(true)
    setDetail(null)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = {
      title: form.title,
      event_type: form.event_type,
      starts_at: form.all_day ? `${form.starts_at.slice(0, 10)}T00:00:00` : form.starts_at,
      ends_at: form.ends_at || null,
      all_day: form.all_day,
      description: form.description || null,
      location: form.location || null,
      contact_id: form.contact_id || null,
    }
    const res = await fetch("/api/calendar/events", { method: "POST", body: JSON.stringify(body) })
    setSaving(false)
    if (res.ok) { toast.success("Event added"); setAdding(false); load() }
    else { const j = await res.json(); toast.error(j.error ?? "Failed") }
  }

  async function deleteEvent(ev: CalEvent) {
    if (ev.source !== "event") {
      toast.error("Edit shoots in /operations/shoots and posts in /content")
      return
    }
    const res = await fetch(`/api/calendar/events?id=${ev.raw_id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Deleted"); setDetail(null); load() }
  }

  async function toggleComplete(ev: CalEvent) {
    if (ev.source !== "event") return
    const res = await fetch("/api/calendar/events", {
      method: "PATCH",
      body: JSON.stringify({ id: ev.raw_id, completed: !ev.completed }),
    })
    if (res.ok) { load() }
  }

  const monthName = new Date(year, month).toLocaleDateString("en-CA", { month: "long", year: "numeric" })

  return (
    <div className="border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="spatia-label text-xs px-2 py-1 border border-border hover:bg-accent transition-colors">←</button>
          <p className="spatia-label text-sm">{monthName}</p>
          <button onClick={nextMonth} className="spatia-label text-xs px-2 py-1 border border-border hover:bg-accent transition-colors">→</button>
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }} className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors">today</button>
        </div>
        {/* Legend */}
        <div className="hidden lg:flex items-center gap-3">
          {Object.entries(TYPE_STYLES).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${v.dot}`} />
              <span className="spatia-label text-xs text-muted-foreground">{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2 text-center spatia-label text-xs text-muted-foreground border-r last:border-r-0 border-border">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty leading cells */}
            {Array.from({ length: firstDow }, (_, i) => (
              <div key={`e${i}`} className={`border-r border-b border-border min-h-24 bg-accent/5 ${(i + 1) % 7 === 0 ? "border-r-0" : ""}`} />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dayEvents = byDay[day] ?? []
              const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day
              const isSelected = selected === day
              const col = (firstDow + i) % 7

              return (
                <div
                  key={day}
                  onClick={() => { setSelected(day); setAdding(false); setDetail(null) }}
                  className={`border-b border-border min-h-24 p-1.5 cursor-pointer transition-colors ${col === 6 ? "" : "border-r"} ${isSelected ? "bg-accent/30" : isToday ? "bg-accent/15" : "hover:bg-accent/10"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`spatia-label text-xs ${isToday ? "text-foreground font-bold" : "text-muted-foreground"}`}>{day}</span>
                    {dayEvents.length > 0 && (
                      <span className="spatia-label text-xs text-muted-foreground">{dayEvents.length}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const s = TYPE_STYLES[ev.type]
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); setDetail(ev); setAdding(false); setSelected(day) }}
                          className={`flex items-center gap-1 px-1 py-0.5 border text-xs cursor-pointer truncate ${s.badge} ${ev.completed ? "opacity-40 line-through" : ""}`}
                        >
                          <span>{s.emoji}</span>
                          <span className="truncate">{ev.title.replace(/^[📷📱📞🤝✓📅]\s/, "")}</span>
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <p className="spatia-label text-xs text-muted-foreground pl-1">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Side panel */}
        {selected !== null && (
          <div className="w-72 shrink-0 border-l border-border flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="spatia-label text-xs">
                {new Date(year, month, selected).toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" })}
              </p>
              <div className="flex gap-2">
                <button onClick={() => openAdd(selected)} className="spatia-label text-xs px-2 py-1 border border-border hover:bg-accent transition-colors">+ add</button>
                <button onClick={() => { setSelected(null); setAdding(false); setDetail(null) }} className="spatia-label text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
            </div>

            {/* Event detail */}
            {detail && (
              <div className="px-4 py-3 border-b border-border space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-xs ${TYPE_STYLES[detail.type].badge}`}>
                      {TYPE_STYLES[detail.type].emoji} {TYPE_STYLES[detail.type].label}
                    </div>
                    <p className="text-sm font-medium">{detail.title.replace(/^[📷📱📞🤝✓📅]\s/, "")}</p>
                    {detail.contact && <p className="text-xs text-muted-foreground">{detail.contact}</p>}
                    {detail.location && <p className="text-xs text-muted-foreground">📍 {detail.location}</p>}
                    {detail.description && <p className="text-xs text-muted-foreground mt-1">{detail.description}</p>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmt(detail.starts_at, detail.all_day)}
                  {detail.ends_at ? ` → ${fmt(detail.ends_at, detail.all_day)}` : ""}
                </p>
                {detail.source === "event" && (
                  <div className="flex gap-2">
                    <button onClick={() => toggleComplete(detail)} className="spatia-label text-xs px-2 py-1 border border-border hover:bg-accent transition-colors">
                      {detail.completed ? "unmark" : "done ✓"}
                    </button>
                    <button onClick={() => deleteEvent(detail)} className="spatia-label text-xs px-2 py-1 border border-border text-muted-foreground hover:text-red-400 transition-colors">delete</button>
                  </div>
                )}
                {detail.source === "shoot" && (
                  <a href="/operations/shoots" className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors">manage shoot →</a>
                )}
                {detail.source === "post" && (
                  <a href="/content" className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors">manage post →</a>
                )}
              </div>
            )}

            {/* Add form */}
            {adding && (
              <form onSubmit={handleAdd} className="px-4 py-3 border-b border-border space-y-3">
                <p className="spatia-label text-xs">new event</p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 space-y-1">
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="title" className="w-full bg-background border border-border px-2 py-1.5 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value as EventType }))} className="w-full bg-background border border-border px-2 py-1.5 text-sm">
                      <option value="call">📞 call</option>
                      <option value="meeting">🤝 meeting</option>
                      <option value="task">✓ task</option>
                      <option value="other">📅 other</option>
                    </select>
                  </div>

                  <label className="col-span-2 flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.all_day} onChange={e => setForm(f => ({ ...f, all_day: e.target.checked }))} />
                    <span className="spatia-label text-muted-foreground">all day</span>
                  </label>

                  {!form.all_day && (
                    <>
                      <div className="space-y-1">
                        <label className="spatia-label text-xs text-muted-foreground">start</label>
                        <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} required className="w-full bg-background border border-border px-2 py-1.5 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="spatia-label text-xs text-muted-foreground">end</label>
                        <input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className="w-full bg-background border border-border px-2 py-1.5 text-xs" />
                      </div>
                    </>
                  )}

                  <div className="col-span-2 space-y-1">
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="location (optional)" className="w-full bg-background border border-border px-2 py-1.5 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="notes (optional)" rows={2} className="w-full bg-background border border-border px-2 py-1.5 text-sm resize-none" />
                  </div>
                  {contacts.length > 0 && (
                    <div className="col-span-2 space-y-1">
                      <select value={form.contact_id} onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))} className="w-full bg-background border border-border px-2 py-1.5 text-sm">
                        <option value="">no client linked</option>
                        {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="spatia-label text-xs px-3 py-1.5 bg-foreground text-background disabled:opacity-50">
                    {saving ? "saving..." : "save"}
                  </button>
                  <button type="button" onClick={() => setAdding(false)} className="spatia-label text-xs px-3 py-1.5 border border-border hover:bg-accent transition-colors">cancel</button>
                </div>
              </form>
            )}

            {/* Day event list */}
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {selectedEvents.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-muted-foreground">nothing scheduled</p>
                  <button onClick={() => openAdd(selected)} className="mt-2 spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors">+ add event</button>
                </div>
              ) : (
                selectedEvents.map((ev) => {
                  const s = TYPE_STYLES[ev.type]
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setDetail(detail?.id === ev.id ? null : ev)}
                      className={`px-4 py-3 cursor-pointer hover:bg-accent/20 transition-colors ${detail?.id === ev.id ? "bg-accent/20" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot} ${ev.completed ? "opacity-40" : ""}`} />
                        <p className={`text-sm flex-1 truncate ${ev.completed ? "line-through text-muted-foreground" : ""}`}>
                          {ev.title.replace(/^[📷📱📞🤝✓📅]\s/, "")}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground ml-4 mt-0.5">
                        {ev.all_day ? "all day" : fmt(ev.starts_at, false)}
                        {ev.contact ? ` · ${ev.contact}` : ""}
                      </p>
                    </div>
                  )
                })
              )}
            </div>

            {/* Upcoming across month */}
            {!selected && (
              <div className="px-4 py-3 border-t border-border">
                <p className="spatia-label text-xs text-muted-foreground mb-2">this month</p>
                {events.slice(0, 5).map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 py-1">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_STYLES[ev.type].dot}`} />
                    <p className="text-xs truncate">{ev.title.replace(/^[📷📱📞🤝✓📅]\s/, "")}</p>
                    <p className="text-xs text-muted-foreground shrink-0 ml-auto">{new Date(ev.starts_at).getDate()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
