"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2, Tag } from "lucide-react"

interface Note {
  id: string
  content: string
  category: string | null
  contact_id: string | null
  created_at: string
  contacts?: { id: string; name: string } | null
}

const CATEGORIES = ["general", "crm", "strategy", "ops", "finance", "ideas"] as const

function timeAgo(date: string) {
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString("fr-CA", { month: "short", day: "numeric" })
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState("")
  const [category, setCategory] = useState<string>("general")
  const [filterCategory, setFilterCategory] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function load(cat?: string) {
    const params = cat ? `?category=${cat}` : ""
    const res = await fetch(`/api/notes${params}`)
    if (res.ok) {
      setNotes(await res.json())
    }
    setLoading(false)
  }

  useEffect(() => {
    load(filterCategory || undefined)
  }, [filterCategory])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), category }),
    })
    if (res.ok) {
      const note = await res.json()
      setNotes((prev) => [note, ...prev])
      setContent("")
      toast.success("Note saved")
    } else {
      toast.error("Failed to save note")
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    const res = await fetch(`/api/notes?id=${id}`, { method: "DELETE" })
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== id))
      toast.success("Note deleted")
    } else {
      toast.error("Failed to delete")
    }
    setConfirmDeleteId(null)
  }

  const filtered = filterCategory ? notes.filter((n) => n.category === filterCategory) : notes

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="font-heading text-xl tracking-tight">notes</h1>
        <p className="text-muted-foreground text-xs mt-0.5">journal — ideas, decisions, context</p>
      </div>

      {/* Compose */}
      <form onSubmit={handleAdd} className="border border-border bg-card p-4 space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a note..."
          rows={3}
          className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground/40"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(e as unknown as React.FormEvent)
          }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={11} strokeWidth={1.5} className="text-muted-foreground" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-xs bg-transparent text-muted-foreground focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground/40 hidden sm:inline">⌘+Enter</span>
            <button
              type="submit"
              disabled={saving || !content.trim()}
              className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 hover:bg-accent transition-colors disabled:opacity-50"
            >
              <Plus size={11} strokeWidth={1.5} />
              {saving ? "saving..." : "add"}
            </button>
          </div>
        </div>
      </form>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory("")}
          className={`text-xs border px-2.5 py-1 transition-colors ${!filterCategory ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          all
        </button>
        {CATEGORIES.map((c) => {
          const count = notes.filter((n) => n.category === c).length
          if (count === 0 && filterCategory !== c) return null
          return (
            <button
              key={c}
              onClick={() => setFilterCategory(filterCategory === c ? "" : c)}
              className={`text-xs border px-2.5 py-1 transition-colors ${filterCategory === c ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {c} {count > 0 && <span className="opacity-50">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">loading...</div>
      ) : filtered.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          {filterCategory ? `no ${filterCategory} notes yet` : "no notes yet — start writing above"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => (
            <div key={note.id} className="border border-border bg-card p-4 group">
              <div className="flex items-start gap-3">
                <p className="text-sm flex-1 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                <button
                  onClick={() => handleDelete(note.id)}
                  className={`shrink-0 p-1 transition-colors opacity-0 group-hover:opacity-100 ${
                    confirmDeleteId === note.id
                      ? "text-red-400 opacity-100"
                      : "text-muted-foreground hover:text-red-400"
                  }`}
                  title={confirmDeleteId === note.id ? "Click again to confirm" : "Delete"}
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {note.category && (
                  <span className="spatia-label text-[10px] text-muted-foreground border border-border px-1.5 py-0.5">
                    {note.category}
                  </span>
                )}
                {note.contacts && (
                  <span className="spatia-label text-[10px] text-muted-foreground">
                    re: {note.contacts.name}
                  </span>
                )}
                <span className="spatia-label text-[10px] text-muted-foreground/50 ml-auto">
                  {timeAgo(note.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
