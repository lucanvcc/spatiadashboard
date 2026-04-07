"use client"

import {
  useEffect, useState, useRef, useCallback, useTransition,
} from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Search, X, ChevronRight, LayoutDashboard, Users, Mail, BarChart2,
  Wrench, Camera, Box, Receipt, FileText, ScanSearch, Settings,
  DollarSign, ShieldCheck, CreditCard, FileUp, Calendar, Zap,
  Clock, Play, Terminal,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandItem {
  id: string
  category: string
  label: string
  description?: string
  icon?: React.ReactNode
  shortcut?: string
  action: () => void
}

interface SearchResult {
  type: string
  id: string
  title: string
  subtitle: string
  url: string
}

// ─── Nav commands ─────────────────────────────────────────────────────────────

const NAV_COMMANDS = [
  { id: "nav-command", label: "Command Center", description: "Vue d'ensemble Spatia OS", icon: <Terminal size={14} strokeWidth={1.5} />, href: "/command", shortcut: "⌘J" },
  { id: "nav-home", label: "Accueil", icon: <LayoutDashboard size={14} strokeWidth={1.5} />, href: "/" },
  { id: "nav-crm", label: "CRM", description: "Contacts et pipeline", icon: <Users size={14} strokeWidth={1.5} />, href: "/crm" },
  { id: "nav-outreach", label: "Outreach", description: "Courriels et campagnes", icon: <Mail size={14} strokeWidth={1.5} />, href: "/outreach" },
  { id: "nav-marketing", label: "Marketing", description: "Publicités et analytics", icon: <BarChart2 size={14} strokeWidth={1.5} />, href: "/marketing" },
  { id: "nav-shoots", label: "Shoots", description: "Gestion des shoots", icon: <Camera size={14} strokeWidth={1.5} />, href: "/operations/shoots" },
  { id: "nav-tours", label: "Tours Matterport", description: "Gestion des slots", icon: <Box size={14} strokeWidth={1.5} />, href: "/operations/tours" },
  { id: "nav-invoices-ops", label: "Factures (ops)", icon: <Receipt size={14} strokeWidth={1.5} />, href: "/operations/invoices" },
  { id: "nav-money", label: "Finances", description: "Aperçu financier", icon: <DollarSign size={14} strokeWidth={1.5} />, href: "/money" },
  { id: "nav-taxes", label: "Taxes", description: "GST/QST — seuil 30K$", icon: <ShieldCheck size={14} strokeWidth={1.5} />, href: "/money/taxes" },
  { id: "nav-expenses", label: "Dépenses", icon: <CreditCard size={14} strokeWidth={1.5} />, href: "/money/expenses" },
  { id: "nav-import-wave", label: "Import Wave", icon: <FileUp size={14} strokeWidth={1.5} />, href: "/money/import-wave" },
  { id: "nav-content", label: "Calendrier de contenu", icon: <Calendar size={14} strokeWidth={1.5} />, href: "/content" },
  { id: "nav-reports", label: "Rapport hebdomadaire", icon: <FileText size={14} strokeWidth={1.5} />, href: "/reports/weekly" },
  { id: "nav-scraper", label: "Scraper Realtor.ca", icon: <ScanSearch size={14} strokeWidth={1.5} />, href: "/tools/scraper" },
  { id: "nav-settings", label: "Paramètres", icon: <Settings size={14} strokeWidth={1.5} />, href: "/settings" },
  { id: "nav-cron", label: "Automatisation", description: "Statut des cron jobs", icon: <Clock size={14} strokeWidth={1.5} />, href: "/settings/cron" },
]

const CRON_COMMANDS = [
  { id: "cron-listing-monitor", jobName: "listing-monitor", label: "Vérifier inscriptions vendues" },
  { id: "cron-followup-reminder", jobName: "followup-reminder", label: "Rappels de relance" },
  { id: "cron-analytics-snapshot", jobName: "analytics-snapshot", label: "Snapshot analytique" },
  { id: "cron-tour-slot-check", jobName: "tour-slot-check", label: "Vérifier slots Matterport" },
  { id: "cron-tax-threshold", jobName: "tax-threshold", label: "Vérifier seuil fiscal" },
  { id: "cron-invoice-overdue", jobName: "invoice-overdue", label: "Factures en retard" },
  { id: "cron-campaign-health", jobName: "campaign-health", label: "Santé des campagnes" },
  { id: "cron-shoot-today", jobName: "shoot-today", label: "Shoots du jour" },
  { id: "cron-weekly-report", jobName: "weekly-report", label: "Rapport hebdomadaire" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function logCommand(command: string, params?: Record<string, unknown>) {
  // Fire-and-forget
  fetch("/api/command/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, params }),
  }).catch(() => {})
}

function searchTypeIcon(type: string) {
  const props = { size: 13, strokeWidth: 1.5, className: "text-muted-foreground shrink-0" }
  switch (type) {
    case "contact": return <Users {...props} />
    case "shoot": return <Camera {...props} />
    case "invoice": return <Receipt {...props} />
    case "campaign": return <BarChart2 {...props} />
    default: return <Search {...props} />
  }
}

// ─── CommandPalette ───────────────────────────────────────────────────────────

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [recentCommands, setRecentCommands] = useState<string[]>([])
  const [cronRunning, setCronRunning] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [, startTransition] = useTransition()

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setSelected(0)
      setSearchResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Load recent commands
  useEffect(() => {
    if (!isOpen) return
    fetch("/api/command/log?limit=5")
      .then((r) => r.json())
      .then((data) => setRecentCommands((data.logs ?? []).map((l: { command: string }) => l.command)))
      .catch(() => {})
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/command/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setSearchResults(data.results ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Build command list
  const navigate = useCallback((href: string, label: string) => {
    logCommand(`navigate:${href}`, { label })
    router.push(href)
    onClose()
  }, [router, onClose])

  const triggerCron = useCallback(async (jobName: string, label: string) => {
    logCommand(`trigger:cron:${jobName}`, { label })
    onClose()
    setCronRunning(jobName)
    toast.loading(`Lancement: ${label}…`, { id: `cron-${jobName}` })
    try {
      const res = await fetch(`/api/cron/trigger/${jobName}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "failed")
      toast.success(`Terminé: ${data.summary ?? label}`, { id: `cron-${jobName}` })
    } catch (err) {
      toast.error(`Erreur: ${err instanceof Error ? err.message : "inconnu"}`, { id: `cron-${jobName}` })
    } finally {
      setCronRunning(null)
    }
  }, [onClose])

  const allCommands: CommandItem[] = [
    // Navigation
    ...NAV_COMMANDS.map((nav) => ({
      id: nav.id,
      category: "Aller à",
      label: nav.label,
      description: nav.description,
      icon: nav.icon,
      shortcut: nav.shortcut,
      action: () => navigate(nav.href, nav.label),
    })),
    // Automation
    ...CRON_COMMANDS.map((cron) => ({
      id: cron.id,
      category: "Automatisation",
      label: `Exécuter: ${cron.label}`,
      icon: <Play size={13} strokeWidth={1.5} className="text-muted-foreground shrink-0" />,
      action: () => triggerCron(cron.jobName, cron.label),
    })),
  ]

  // Filter by query
  const q = query.toLowerCase().trim()
  const filteredCommands = q
    ? allCommands.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      )
    : allCommands

  // Group results
  type ResultItem =
    | { kind: "command"; item: CommandItem }
    | { kind: "search"; item: SearchResult }

  const visibleItems: ResultItem[] = []

  if (!q) {
    // Show navigation subset + automation
    const nav = filteredCommands.filter((c) => c.category === "Aller à").slice(0, 8)
    const auto = filteredCommands.filter((c) => c.category === "Automatisation").slice(0, 5)
    for (const item of nav) visibleItems.push({ kind: "command", item })
    for (const item of auto) visibleItems.push({ kind: "command", item })
  } else {
    // Search results first
    for (const item of searchResults) visibleItems.push({ kind: "search", item })
    // Then matching commands
    for (const item of filteredCommands.slice(0, 10)) visibleItems.push({ kind: "command", item })
  }

  // Group by category for display
  const grouped: { category: string; items: ResultItem[] }[] = []
  for (const vi of visibleItems) {
    const cat =
      vi.kind === "search" ? "Résultats" :
      vi.item.category
    const group = grouped.find((g) => g.category === cat)
    if (group) group.items.push(vi)
    else grouped.push({ category: cat, items: [vi] })
  }

  // Flat list for keyboard navigation
  const flatItems = grouped.flatMap((g) => g.items)
  const totalItems = flatItems.length

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, totalItems - 1))
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      }
      if (e.key === "Enter") {
        e.preventDefault()
        const vi = flatItems[selected]
        if (!vi) return
        if (vi.kind === "command") vi.item.action()
        else if (vi.kind === "search") {
          logCommand(`search:${vi.item.type}`, { id: vi.item.id, title: vi.item.title })
          router.push(vi.item.url)
          onClose()
        }
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, selected, totalItems, flatItems, onClose, router])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [selected])

  if (!isOpen) return null

  let flatIndex = 0

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative bg-card border border-border w-full max-w-2xl mx-4 shadow-2xl"
        style={{ maxHeight: "70vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search size={15} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Rechercher, naviguer, exécuter…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searchLoading && (
            <span className="spatia-label text-[10px] text-muted-foreground">recherche…</span>
          )}
          <div className="flex items-center gap-1 text-muted-foreground/50">
            <kbd className="spatia-label text-[10px] border border-border/60 px-1 py-0.5">esc</kbd>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 60px)" }}>
          {grouped.length === 0 && q && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">Aucun résultat pour &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.category}>
              <div className="px-4 py-1.5 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">
                  {group.category}
                </p>
              </div>

              {group.items.map((vi) => {
                const idx = flatIndex++
                const isSelected = idx === selected

                if (vi.kind === "search") {
                  const sr = vi.item
                  return (
                    <button
                      key={sr.id}
                      data-index={idx}
                      onClick={() => {
                        logCommand(`search:${sr.type}`, { id: sr.id })
                        startTransition(() => router.push(sr.url))
                        onClose()
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      {searchTypeIcon(sr.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{sr.title}</p>
                        {sr.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{sr.subtitle}</p>
                        )}
                      </div>
                      <ChevronRight size={12} strokeWidth={1.5} className="text-muted-foreground/40 shrink-0" />
                    </button>
                  )
                }

                const cmd = vi.item
                return (
                  <button
                    key={cmd.id}
                    data-index={idx}
                    onClick={cmd.action}
                    disabled={cronRunning !== null && cmd.category === "Automatisation"}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-50 ${
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    {cmd.icon && <span className="shrink-0">{cmd.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{cmd.label}</p>
                      {cmd.description && (
                        <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="spatia-label text-[10px] border border-border/60 px-1.5 py-0.5 text-muted-foreground/60 shrink-0">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    <ChevronRight size={12} strokeWidth={1.5} className="text-muted-foreground/40 shrink-0" />
                  </button>
                )
              })}
            </div>
          ))}

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 spatia-label">
              <span>↑↓ naviguer</span>
              <span>↵ sélectionner</span>
              <span>esc fermer</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground/40">
              <Zap size={9} strokeWidth={1.5} />
              <span className="spatia-label text-[10px]">spatia os</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
