"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

// ── Shortcut help overlay ────────────────────────────────────────────────────

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Search contacts" },
  { keys: ["⌘", "N"], label: "New contact" },
  { keys: ["⌘", "E"], label: "New email" },
  { keys: ["⌘", "S"], label: "New shoot" },
  { keys: ["?"], label: "Show shortcuts" },
]

function ShortcutHelpOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-card border border-border w-80 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="spatia-label text-xs">keyboard shortcuts</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        <ul className="space-y-3">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs border border-border bg-muted text-muted-foreground font-mono min-w-[1.5rem]"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Contact search overlay (Cmd+K) ───────────────────────────────────────────

interface Contact {
  id: string
  name: string
  email: string | null
  agency: string | null
  status: string
}

function ContactSearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowDown") setSelected((s) => Math.min(s + 1, contacts.length - 1))
      if (e.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0))
      if (e.key === "Enter" && contacts[selected]) {
        router.push(`/crm?contact=${contacts[selected].id}`)
        onClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [contacts, selected, onClose, router])

  useEffect(() => {
    if (!query.trim()) {
      setContacts([])
      return
    }
    setLoading(true)
    const controller = new AbortController()
    fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setContacts(data.contacts ?? [])
        setSelected(0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [query])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-card border border-border w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && <span className="spatia-label text-xs">searching...</span>}
        </div>

        {/* Results */}
        {contacts.length > 0 && (
          <ul className="max-h-64 overflow-y-auto">
            {contacts.map((c, i) => (
              <li key={c.id}>
                <button
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    i === selected ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                  onClick={() => {
                    router.push(`/crm?contact=${c.id}`)
                    onClose()
                  }}
                >
                  <div>
                    <p className="text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.agency ?? c.email ?? ""}</p>
                  </div>
                  <span className="spatia-label text-xs text-muted-foreground">{c.status.replace(/_/g, " ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query && !loading && contacts.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No contacts found for "{query}"</p>
          </div>
        )}

        {!query && (
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Type a name, email, or agency...</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main provider ─────────────────────────────────────────────────────────────

export function KeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const router = useRouter()

  const isInputFocused = () => {
    const el = document.activeElement
    if (!el) return false
    return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || (el as HTMLElement).isContentEditable
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // ? → help overlay (not in input)
      if (e.key === "?" && !isInputFocused() && !mod) {
        e.preventDefault()
        setShowHelp(true)
        return
      }

      // Cmd+K → search contacts
      if (mod && e.key === "k") {
        e.preventDefault()
        setShowSearch(true)
        return
      }

      // Cmd+N → new contact
      if (mod && e.key === "n") {
        e.preventDefault()
        router.push("/crm?new=1")
        return
      }

      // Cmd+E → new email
      if (mod && e.key === "e") {
        e.preventDefault()
        router.push("/outreach?new=1")
        return
      }

      // Cmd+Shift+S → new shoot (avoid conflict with browser save)
      if (mod && e.shiftKey && e.key === "S") {
        e.preventDefault()
        router.push("/operations/shoots?new=1")
        return
      }
    },
    [router]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <>
      {showHelp && <ShortcutHelpOverlay onClose={() => setShowHelp(false)} />}
      {showSearch && <ContactSearchOverlay onClose={() => setShowSearch(false)} />}
    </>
  )
}
