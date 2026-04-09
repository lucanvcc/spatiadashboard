"use client"

import { useState, useCallback, useRef } from "react"
import { toast } from "sonner"
import { Upload, CheckCircle2, AlertCircle, Clock, SkipForward } from "lucide-react"
import type { ImportBatch, WaveRawImport, ImportSourceType } from "@/types"

interface Contact {
  id: string
  name: string
  agency: string | null
}

interface BatchDetail {
  batch: ImportBatch
  rows: WaveRawImport[]
}

const STATUS_ICONS = {
  matched: <CheckCircle2 size={12} strokeWidth={1.5} className="text-emerald-400 shrink-0" />,
  partial: <Clock size={12} strokeWidth={1.5} className="text-amber-400 shrink-0" />,
  failed: <AlertCircle size={12} strokeWidth={1.5} className="text-red-400 shrink-0" />,
  skipped: <SkipForward size={12} strokeWidth={1.5} className="text-muted-foreground shrink-0" />,
  pending: <Clock size={12} strokeWidth={1.5} className="text-muted-foreground shrink-0" />,
}

const STATUS_LABELS: Record<string, string> = {
  matched: "text-emerald-400",
  partial: "text-amber-400",
  failed: "text-red-400",
  skipped: "text-muted-foreground",
  pending: "text-muted-foreground",
}

export function WaveImportClient({ contacts }: { contacts: Contact[] }) {
  const [file, setFile] = useState<File | null>(null)
  const [sourceType, setSourceType] = useState<ImportSourceType>("wave_invoices")
  const [uploading, setUploading] = useState(false)
  const [batches, setBatches] = useState<ImportBatch[] | null>(null)
  const [activeBatch, setActiveBatch] = useState<BatchDetail | null>(null)
  const [linkModal, setLinkModal] = useState<{ rowId: string; batchId: string } | null>(null)
  const [linkContactId, setLinkContactId] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const loadBatches = useCallback(async () => {
    const res = await fetch("/api/money/import-wave")
    if (res.ok) setBatches(await res.json())
  }, [])

  const loadBatch = useCallback(async (batchId: string) => {
    const res = await fetch(`/api/money/import-wave/${batchId}`)
    if (res.ok) setActiveBatch(await res.json())
  }, [])

  // Load batches on mount
  useState(() => {
    loadBatches()
  })

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("source_type", sourceType)

    try {
      const res = await fetch("/api/money/import-wave", { method: "POST", body: fd })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Import failed")
        return
      }

      toast.success(
        `Imported ${data.totalRows} rows — ${data.matched} matched, ${data.partial} partial, ${data.failed} failed`
      )
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      await loadBatches()
      await loadBatch(data.batchId)
    } catch {
      toast.error("Network error during upload")
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith(".csv")) setFile(f)
    else toast.error("Please drop a CSV file")
  }

  async function handleLink() {
    if (!linkModal || !linkContactId) return
    const res = await fetch(
      `/api/money/import-wave/${linkModal.batchId}/rows/${linkModal.rowId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link",
          contact_id: linkContactId,
        }),
      }
    )
    if (res.ok) {
      toast.success("Linked to contact")
      setLinkModal(null)
      setLinkContactId("")
      await loadBatch(linkModal.batchId)
    } else {
      toast.error("Failed to link")
    }
  }

  async function handleSkip(rowId: string, batchId: string) {
    const res = await fetch(`/api/money/import-wave/${batchId}/rows/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip" }),
    })
    if (res.ok) {
      toast.success("Row skipped")
      await loadBatch(batchId)
    } else {
      toast.error("Failed")
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div className="border border-border bg-card p-5 space-y-5">
        <p className="spatia-label text-xs text-muted-foreground">upload csv</p>

        {/* Source type toggle */}
        <div className="flex gap-2">
          {(["wave_invoices", "wave_expenses"] as ImportSourceType[]).map((t) => (
            <button
              key={t}
              onClick={() => setSourceType(t)}
              className={`spatia-label px-4 py-2 text-sm border transition-colors ${
                sourceType === t
                  ? "border-foreground bg-accent text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "wave_invoices" ? "invoices" : "expenses"}
            </button>
          ))}
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
            dragging ? "border-foreground bg-accent/20" : "border-border hover:border-foreground/40"
          }`}
        >
          <Upload size={24} strokeWidth={1.5} className="mx-auto mb-3 text-muted-foreground" />
          {file ? (
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(file.size / 1024).toFixed(1)} KB — click to change
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">
                drag & drop CSV or click to browse
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Wave invoice export or transaction export
              </p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="spatia-label px-5 py-2.5 bg-foreground text-background hover:opacity-80 text-sm disabled:opacity-40 transition-opacity"
        >
          {uploading ? "processing..." : "upload & process"}
        </button>
      </div>

      {/* Active batch review */}
      {activeBatch && (
        <div className="border border-border bg-card space-y-0">
          <div className="p-5 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="spatia-label text-xs text-muted-foreground">
                {activeBatch.batch.filename} · {new Date(activeBatch.batch.uploaded_at).toLocaleDateString("en-CA")}
              </p>
              <button
                onClick={() => setActiveBatch(null)}
                className="spatia-label text-xs text-muted-foreground hover:text-foreground"
              >
                close ×
              </button>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-emerald-400">{activeBatch.batch.matched_rows} matched</span>
              <span className="text-amber-400">{activeBatch.batch.partial_rows} partial</span>
              <span className="text-red-400">{activeBatch.batch.failed_rows} failed</span>
              <span className="text-muted-foreground">{activeBatch.batch.skipped_rows} skipped</span>
            </div>
          </div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {activeBatch.rows.map((row) => {
              const preview = Object.entries(row.row_raw)
                .slice(0, 4)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")
              return (
                <div key={row.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2 min-w-0">
                    {STATUS_ICONS[row.parsed_status] ?? STATUS_ICONS.pending}
                    <div className="min-w-0">
                      <p className={`spatia-label text-xs ${STATUS_LABELS[row.parsed_status] ?? ""}`}>
                        {row.parsed_status}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>
                      {row.error_message && (
                        <p className="text-xs text-red-400 mt-0.5">{row.error_message}</p>
                      )}
                    </div>
                  </div>
                  {(row.parsed_status === "partial" || row.parsed_status === "failed") && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() =>
                          setLinkModal({ rowId: row.id, batchId: row.import_batch_id })
                        }
                        className="spatia-label text-xs px-3 py-1 border border-amber-400/50 text-amber-400 hover:bg-amber-400/10 transition-colors"
                      >
                        link
                      </button>
                      <button
                        onClick={() => handleSkip(row.id, row.import_batch_id)}
                        className="spatia-label text-xs px-3 py-1 border border-border text-muted-foreground hover:text-foreground transition-colors"
                      >
                        skip
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Import history */}
      {batches !== null && (
        <div className="border border-border bg-card space-y-0">
          <div className="p-5 border-b border-border">
            <p className="spatia-label text-xs text-muted-foreground">import history</p>
          </div>
          {batches.length === 0 ? (
            <div className="p-5">
              <p className="text-sm text-muted-foreground">no imports yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {batches.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-sm">{b.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.uploaded_at).toLocaleDateString("en-CA", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {b.source_type.replace("wave_", "").replace("_", " ")} · {b.total_rows} rows
                    </p>
                    <div className="flex gap-3 text-xs">
                      <span className="text-emerald-400">{b.matched_rows} matched</span>
                      {b.partial_rows > 0 && (
                        <span className="text-amber-400">{b.partial_rows} partial</span>
                      )}
                      {b.failed_rows > 0 && (
                        <span className="text-red-400">{b.failed_rows} failed</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => loadBatch(b.id)}
                    className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    review →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Link modal */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border p-6 space-y-4 w-full max-w-sm">
            <p className="spatia-label text-sm">link to contact</p>
            <div className="space-y-1">
              <label className="spatia-label text-xs text-muted-foreground">select contact</label>
              <select
                value={linkContactId}
                onChange={(e) => setLinkContactId(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm"
              >
                <option value="">— select —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.agency ? ` — ${c.agency}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleLink}
                disabled={!linkContactId}
                className="spatia-label px-4 py-2 bg-foreground text-background hover:opacity-80 text-sm disabled:opacity-40"
              >
                link
              </button>
              <button
                onClick={() => { setLinkModal(null); setLinkContactId("") }}
                className="spatia-label px-4 py-2 border border-border hover:bg-accent text-sm"
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
