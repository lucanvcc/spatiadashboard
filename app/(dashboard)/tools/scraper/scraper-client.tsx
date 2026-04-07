"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { Search, Download, Users, Clock, CheckSquare, Square, AlertTriangle, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ScrapedAgent } from "@/lib/scraper/realtor-ca"

interface ScrapeLog {
  id: string
  query: string
  results_count: number
  imported_count: number
  ran_at: string
  meta?: { total_listings_scanned?: number; pages_fetched?: number }
}

interface Props {
  recentScrapes: ScrapeLog[]
  existingEmails: Set<string>
  existingPhones: Set<string>
}

type AgentWithDupe = ScrapedAgent & { is_duplicate: boolean }

type ScrapeStatus = "idle" | "estimating" | "confirming" | "scraping" | "done" | "error"

export function ScraperClient({ recentScrapes: initialScrapes, existingEmails, existingPhones }: Props) {
  const [query, setQuery] = useState("")
  const [maxResults, setMaxResults] = useState(100)
  const [status, setStatus] = useState<ScrapeStatus>("idle")
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null)
  const [agents, setAgents] = useState<AgentWithDupe[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [recentScrapes, setRecentScrapes] = useState(initialScrapes)
  const abortRef = useRef(false)

  function estimatedMinutes(count: number): string {
    // 2s per listing page × ~12 results/page
    const pages = Math.ceil(Math.min(count, maxResults) / 12)
    const secs = pages * 2.5
    if (secs < 60) return `~${Math.round(secs)}s`
    return `~${Math.ceil(secs / 60)}m`
  }

  async function handleEstimate() {
    if (!query.trim()) return toast.error("Enter a search query first")
    setStatus("estimating")
    try {
      const res = await fetch(`/api/scraper/realtor-ca?query=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      setEstimatedCount(data.estimated_results ?? 0)
      setStatus("confirming")
    } catch {
      toast.error("Failed to estimate — check connection")
      setStatus("idle")
    }
  }

  async function handleScrape() {
    setStatus("scraping")
    abortRef.current = false

    try {
      const res = await fetch("/api/scraper/realtor-ca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), maxResults }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Scrape failed")
      }

      const data = await res.json()
      const enriched: AgentWithDupe[] = (data.agents ?? []).map((a: ScrapedAgent) => ({
        ...a,
        is_duplicate: checkDuplicate(a),
      }))

      setAgents(enriched)
      // Auto-select non-duplicates
      const autoSelected = new Set<number>()
      enriched.forEach((a, i) => { if (!a.is_duplicate) autoSelected.add(i) })
      setSelected(autoSelected)
      setStatus("done")

      // Refresh scrape logs from local state
      setRecentScrapes((prev) => [
        {
          id: crypto.randomUUID(),
          query: query.trim(),
          results_count: enriched.length,
          imported_count: 0,
          ran_at: new Date().toISOString(),
        },
        ...prev.slice(0, 9),
      ])

      toast.success(`Found ${enriched.length} agents`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scrape failed")
      setStatus("error")
    }
  }

  function checkDuplicate(agent: ScrapedAgent): boolean {
    if (agent.email && existingEmails.has(agent.email.toLowerCase())) return true
    if (agent.phone) {
      const digits = agent.phone.replace(/\D/g, "")
      if (existingPhones.has(digits)) return true
    }
    return false
  }

  function toggleSelect(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === agents.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(agents.map((_, i) => i)))
    }
  }

  async function handleImport() {
    const toImport = agents.filter((_, i) => selected.has(i))
    if (toImport.length === 0) return toast.error("Select at least one agent")

    setImporting(true)
    try {
      const res = await fetch("/api/scraper/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: toImport }),
      })
      const data = await res.json()
      toast.success(
        `Imported ${data.imported} · ${data.skipped_duplicate} already in CRM · ${data.errors} errors`
      )
    } catch {
      toast.error("Import failed")
    } finally {
      setImporting(false)
    }
  }

  const newCount = agents.filter((a) => !a.is_duplicate).length
  const dupeCount = agents.filter((a) => a.is_duplicate).length

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="space-y-0.5">
        <h1 className="font-heading text-xl tracking-tight">realtor.ca scraper</h1>
        <p className="text-xs text-muted-foreground">
          find agents on the south shore · rate limited · public business info only
        </p>
      </div>

      {/* Search */}
      <div className="border border-border p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Brossard, Longueuil, RE/MAX Rive-Sud..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setStatus("idle"); setEstimatedCount(null) }}
            onKeyDown={(e) => e.key === "Enter" && status === "idle" && handleEstimate()}
            className="font-mono text-sm"
            disabled={status === "estimating" || status === "scraping"}
          />
          <div className="flex items-center gap-1 shrink-0">
            <label className="text-xs text-muted-foreground whitespace-nowrap">max</label>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="text-xs border border-border bg-background px-2 py-1.5 h-9"
              disabled={status === "estimating" || status === "scraping"}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {status === "idle" && (
          <Button variant="outline" size="sm" onClick={handleEstimate} disabled={!query.trim()}>
            <Search size={12} strokeWidth={1.5} className="mr-2" />
            estimate results
          </Button>
        )}

        {status === "estimating" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            estimating...
          </div>
        )}

        {status === "confirming" && estimatedCount !== null && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              ~{estimatedCount} listings found · will take {estimatedMinutes(estimatedCount)} · scrapes {Math.min(estimatedCount, maxResults)} results
            </span>
            <Button size="sm" onClick={handleScrape}>
              <ArrowRight size={12} strokeWidth={1.5} className="mr-2" />
              scrape
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStatus("idle")}>
              cancel
            </Button>
          </div>
        )}

        {status === "scraping" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            scraping realtor.ca — rate limited at 1 req/2s...
          </div>
        )}

        {(status === "done" || status === "error") && (
          <Button variant="outline" size="sm" onClick={() => { setStatus("idle"); setAgents([]); setSelected(new Set()); setEstimatedCount(null) }}>
            new search
          </Button>
        )}
      </div>

      {/* Results */}
      {agents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users size={12} />
                {agents.length} agents found
              </span>
              <span>{newCount} new</span>
              {dupeCount > 0 && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <AlertTriangle size={12} />
                  {dupeCount} already in crm
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAll}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {selected.size === agents.length ? <CheckSquare size={12} /> : <Square size={12} />}
                {selected.size === agents.length ? "deselect all" : "select all"}
              </button>
              <Button
                size="sm"
                disabled={selected.size === 0 || importing}
                onClick={handleImport}
              >
                {importing ? (
                  <Loader2 size={12} className="animate-spin mr-2" />
                ) : (
                  <Download size={12} strokeWidth={1.5} className="mr-2" />
                )}
                import {selected.size > 0 ? `${selected.size} selected` : "selected"}
              </Button>
            </div>
          </div>

          <div className="border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">agent</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">brokerage</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">phone</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">email</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">areas</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">listings</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-border last:border-0 cursor-pointer hover:bg-accent/30 transition-colors ${
                      agent.is_duplicate ? "opacity-60" : ""
                    } ${selected.has(idx) ? "bg-accent/20" : ""}`}
                    onClick={() => toggleSelect(idx)}
                  >
                    <td className="px-3 py-2">
                      {selected.has(idx) ? (
                        <CheckSquare size={12} className="text-foreground" />
                      ) : (
                        <Square size={12} className="text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {agent.is_duplicate && (
                          <span className="text-yellow-500 shrink-0" title="already in CRM">
                            <AlertTriangle size={10} />
                          </span>
                        )}
                        <span className="font-medium">
                          {agent.profile_url ? (
                            <a
                              href={agent.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                            >
                              {agent.name}
                            </a>
                          ) : (
                            agent.name
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{agent.brokerage ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{agent.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{agent.email ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {agent.areas_served.slice(0, 2).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{agent.active_listings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent scrape history */}
      {recentScrapes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">recent scrapes</h2>
          <div className="border border-border divide-y divide-border">
            {recentScrapes.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <Search size={11} className="text-muted-foreground shrink-0" />
                  <span className="font-mono">{log.query}</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>{log.results_count} found</span>
                  {log.imported_count > 0 && <span>{log.imported_count} imported</span>}
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(log.ran_at).toLocaleDateString("fr-CA", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
