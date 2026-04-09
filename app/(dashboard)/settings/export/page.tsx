"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Download, Trash2 } from "lucide-react"
import Link from "next/link"

const TABLES = [
  { key: "contacts", label: "contacts", desc: "All leads and clients" },
  { key: "shoots", label: "shoots", desc: "Booked and completed shoots" },
  { key: "invoices", label: "invoices", desc: "All invoices" },
  { key: "outreach_emails", label: "outreach emails", desc: "Sent/drafted emails" },
  { key: "campaigns", label: "campaigns", desc: "Outreach campaigns" },
  { key: "tours", label: "tours", desc: "Active Matterport tours" },
  { key: "content_calendar", label: "content calendar", desc: "Scheduled social posts" },
  { key: "marketing_spend", label: "marketing spend", desc: "Ad spend records" },
  { key: "revenue_events", label: "revenue events", desc: "Revenue attribution" },
  { key: "notes", label: "notes", desc: "All notes" },
  { key: "expenses", label: "expenses", desc: "Business expenses" },
] as const

type TableKey = (typeof TABLES)[number]["key"]

export default function ExportPage() {
  const [downloading, setDownloading] = useState<TableKey | null>(null)
  const [purging, setPurging] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function handleDownload(table: TableKey) {
    setDownloading(table)
    try {
      const res = await fetch(`/api/settings/export?table=${table}`)
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? "Export failed")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${table}_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${table}.csv downloaded`)
    } catch {
      toast.error("Download failed")
    }
    setDownloading(null)
  }

  async function handlePurge(action: string, label: string) {
    if (confirmDelete !== action) {
      setConfirmDelete(action)
      return
    }
    setPurging(action)
    setConfirmDelete(null)
    const res = await fetch(`/api/settings/export?action=${action}`, { method: "DELETE" })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Purged ${data.deleted} ${label}`)
    } else {
      toast.error(data.error ?? "Purge failed")
    }
    setPurging(null)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="font-heading text-xl tracking-tight">export & danger zone</h1>
          <p className="text-muted-foreground text-xs mt-0.5">csv exports and maintenance actions</p>
        </div>
      </div>

      {/* Exports */}
      <section className="space-y-3">
        <p className="spatia-label text-xs text-muted-foreground">data exports</p>
        <div className="border border-border divide-y divide-border">
          {TABLES.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <button
                onClick={() => handleDownload(key)}
                disabled={downloading === key}
                className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 hover:bg-accent transition-colors disabled:opacity-50 shrink-0 ml-4"
              >
                <Download size={11} strokeWidth={1.5} />
                {downloading === key ? "..." : "csv"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-3">
        <p className="spatia-label text-xs text-red-400">danger zone</p>
        <div className="border border-red-500/20 divide-y divide-red-500/10">
          {[
            { action: "purge-cron-logs", label: "cron logs older than 30 days", desc: "Deletes cron run history from >30 days ago" },
            { action: "purge-dismissed-alerts", label: "dismissed alerts", desc: "Permanently removes all dismissed system alerts" },
          ].map(({ action, label, desc }) => (
            <div key={action} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <button
                onClick={() => handlePurge(action, label)}
                disabled={purging === action}
                className={`flex items-center gap-1.5 text-xs border px-3 py-1.5 transition-colors disabled:opacity-50 shrink-0 ml-4 ${
                  confirmDelete === action
                    ? "border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Trash2 size={11} strokeWidth={1.5} />
                {purging === action ? "..." : confirmDelete === action ? "confirm?" : "purge"}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/50">
          Click once to arm, click again to confirm. These actions are irreversible.
        </p>
      </section>
    </div>
  )
}
