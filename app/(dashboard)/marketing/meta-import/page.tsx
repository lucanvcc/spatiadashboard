"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle, AlertCircle, Info } from "lucide-react"
import Link from "next/link"

type ImportResult = {
  total: number
  inserted: number
  skipped: number
  failed: number
  errors?: string[]
}

type TabKey = "ads" | "organic"

const TAB_CONFIG: Record<
  TabKey,
  {
    label: string
    endpoint: string
    platformParam?: string
    columns: string[]
    example: string
    description: string
    destination: string
  }
> = {
  ads: {
    label: "meta ads (paid)",
    endpoint: "/api/marketing/meta/ads-import",
    columns: ["Campaign name", "Day", "Amount spent (CAD)", "Impressions", "Clicks (all)", "Results", "Reach"],
    example: "My Campaign,2024-04-01,12.50,1200,34,2,900",
    description:
      "Export from Meta Ads Manager → Ads Reporting → download CSV. Required columns: Campaign name, Day, Amount spent.",
    destination: "marketing_spend (channel = meta)",
  },
  organic: {
    label: "instagram organic",
    endpoint: "/api/marketing/meta/organic-import",
    columns: ["Post ID", "Date", "Likes", "Comments", "Saves", "Shares", "Reach", "Impressions", "Profile visits"],
    example: "1234567890,2024-04-01,45,3,12,1,980,1100,22",
    description:
      "Export from Instagram Professional Dashboard → Insights → download CSV. Optional: add a 'Content calendar ID' column to link posts.",
    destination: "social_post_metrics",
  },
}

function ResultBanner({ result }: { result: ImportResult }) {
  return (
    <div className="border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle size={13} strokeWidth={1.5} className="text-emerald-400 shrink-0" />
        <p className="spatia-label text-xs text-emerald-400">import complete</p>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "total rows", value: result.total },
          { label: "inserted", value: result.inserted, color: "text-emerald-400" },
          { label: "skipped", value: result.skipped, color: "text-muted-foreground" },
          { label: "failed", value: result.failed, color: result.failed > 0 ? "text-amber-400" : "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="space-y-0.5">
            <p className="spatia-label text-xs text-muted-foreground">{label}</p>
            <p className={`font-heading text-lg ${color ?? ""}`}>{value}</p>
          </div>
        ))}
      </div>
      {result.errors && result.errors.length > 0 && (
        <div className="space-y-1">
          <p className="spatia-label text-xs text-amber-400">row errors</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {result.errors.slice(0, 10).map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground font-mono">
                {e}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ImportPanel({ tabKey }: { tabKey: TabKey }) {
  const cfg = TAB_CONFIG[tabKey]
  const [file, setFile] = useState<File | null>(null)
  const [platform, setPlatform] = useState("instagram")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const form = new FormData()
      form.append("file", file)

      let url = cfg.endpoint
      if (tabKey === "organic") url += `?platform=${platform}`

      const res = await fetch(url, { method: "POST", body: form })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`)
      } else {
        setResult(data)
        setFile(null)
        if (inputRef.current) inputRef.current.value = ""
      }
    } catch (err: any) {
      setError(err.message ?? "Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info size={12} strokeWidth={1.5} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{cfg.description}</p>
            <p className="spatia-label text-xs text-muted-foreground">
              destination: <code className="text-foreground/70">{cfg.destination}</code>
            </p>
          </div>
        </div>
        <div>
          <p className="spatia-label text-xs text-muted-foreground mb-1.5">expected columns</p>
          <div className="flex flex-wrap gap-1">
            {cfg.columns.map((col) => (
              <span key={col} className="spatia-label text-[10px] border border-border px-1.5 py-0.5 text-muted-foreground">
                {col}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="spatia-label text-xs text-muted-foreground mb-1">example row</p>
          <code className="text-xs text-muted-foreground/70 block">{cfg.example}</code>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {tabKey === "organic" && (
          <div className="space-y-1.5">
            <label className="spatia-label text-xs text-muted-foreground">platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="block w-full bg-card border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
            >
              <option value="instagram">instagram</option>
              <option value="tiktok">tiktok</option>
              <option value="youtube">youtube</option>
              <option value="linkedin">linkedin</option>
              <option value="facebook">facebook</option>
              <option value="other">other</option>
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="spatia-label text-xs text-muted-foreground">csv file</label>
          <div
            className={`border-2 border-dashed border-border bg-card p-8 text-center cursor-pointer hover:border-foreground/30 transition-colors ${
              file ? "border-foreground/20" : ""
            }`}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={18} strokeWidth={1.5} className="mx-auto text-muted-foreground mb-2" />
            {file ? (
              <div>
                <p className="text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">drop CSV or click to browse</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">UTF-8 encoded · max 10MB</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 border border-red-400/30 bg-red-400/5 p-3">
            <AlertCircle size={12} strokeWidth={1.5} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!file || loading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm border border-border hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Upload size={13} strokeWidth={1.5} />
          {loading ? "importing..." : "import"}
        </button>
      </form>

      {result && <ResultBanner result={result} />}
    </div>
  )
}

export default function MetaImportPage() {
  const [tab, setTab] = useState<TabKey>("ads")

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-xl tracking-tight">meta import</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            upload CSV exports from meta ads manager or instagram insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/marketing/meta"
            className="spatia-label text-xs border border-border px-3 py-2 hover:bg-accent transition-colors text-muted-foreground"
          >
            ← paid analytics
          </Link>
          <Link
            href="/marketing/meta/organic"
            className="spatia-label text-xs border border-border px-3 py-2 hover:bg-accent transition-colors text-muted-foreground"
          >
            organic analytics →
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(Object.keys(TAB_CONFIG) as TabKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`spatia-label px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_CONFIG[key].label}
          </button>
        ))}
      </div>

      <ImportPanel key={tab} tabKey={tab} />
    </div>
  )
}
