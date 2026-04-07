"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Upload, FileText, ArrowLeft, Check } from "lucide-react"
import Link from "next/link"

type ParsedRow = Record<string, string>

const CONTACT_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone", required: false },
  { key: "agency", label: "Agency", required: false },
  { key: "area", label: "Area / Zone", required: false },
  { key: "source", label: "Source", required: false },
  { key: "notes", label: "Notes", required: false },
]

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"' && !inQuotes) { inQuotes = true; continue }
      if (ch === '"' && inQuotes) { inQuotes = false; continue }
      if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue }
      current += ch
    }
    result.push(current.trim())
    return result
  }

  const headers = parseRow(lines[0])
  const rows = lines.slice(1).map((line) => {
    const values = parseRow(line)
    return headers.reduce<ParsedRow>((acc, h, i) => {
      acc[h] = values[i] ?? ""
      return acc
    }, {})
  })

  return { headers, rows }
}

function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const lower = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "")

  for (const field of CONTACT_FIELDS) {
    const match = headers.find((h) => {
      const lh = lower(h)
      return (
        lh === field.key ||
        lh.includes(field.key) ||
        (field.key === "name" && (lh.includes("nom") || lh.includes("prenom") || lh.includes("full"))) ||
        (field.key === "email" && (lh.includes("mail") || lh.includes("courriel"))) ||
        (field.key === "agency" && (lh.includes("agence") || lh.includes("courtage") || lh.includes("broker"))) ||
        (field.key === "area" && (lh.includes("zone") || lh.includes("region") || lh.includes("ville") || lh.includes("city"))) ||
        (field.key === "phone" && (lh.includes("tel") || lh.includes("phone") || lh.includes("mobile")))
      )
    })
    if (match) mapping[field.key] = match
  }
  return mapping
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [fileName, setFileName] = useState("")

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const p = parseCSV(text)
      setParsed(p)
      setMapping(autoMap(p.headers))
    }
    reader.readAsText(file, "UTF-8")
  }

  async function handleImport() {
    if (!parsed || !mapping.email) {
      toast.error("Email column is required")
      return
    }

    setImporting(true)

    const contacts = parsed.rows.map((row) => {
      const c: Record<string, string> = {}
      for (const field of CONTACT_FIELDS) {
        const col = mapping[field.key]
        if (col && row[col]) c[field.key] = row[col]
      }
      return c
    }).filter((c) => c.email)

    if (contacts.length === 0) {
      toast.error("No valid contacts found")
      setImporting(false)
      return
    }

    const res = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts }),
    })

    const data = await res.json()
    if (res.ok) {
      setResult({ inserted: data.inserted, skipped: data.skipped })
      toast.success(`Imported ${data.inserted} contacts (${data.skipped} skipped as duplicates)`)
    } else {
      toast.error(data.error ?? "Import failed")
    }
    setImporting(false)
  }

  const previewRows = parsed?.rows.slice(0, 5) ?? []

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/crm" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="font-heading text-xl tracking-tight">import contacts</h1>
          <p className="text-xs text-muted-foreground">CSV upload from Google Sheets or any spreadsheet</p>
        </div>
      </div>

      {/* Upload zone */}
      <div
        className="border border-dashed border-border p-10 text-center space-y-3 cursor-pointer hover:border-foreground/30 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <div className="flex justify-center">
          {fileName ? (
            <FileText size={28} strokeWidth={1} className="text-muted-foreground" />
          ) : (
            <Upload size={28} strokeWidth={1} className="text-muted-foreground" />
          )}
        </div>
        <div>
          {fileName ? (
            <p className="text-sm font-medium">{fileName}</p>
          ) : (
            <>
              <p className="text-sm">drop a CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">UTF-8 encoded, comma-separated</p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {/* Column mapping */}
      {parsed && (
        <div className="border border-border p-5 space-y-4">
          <p className="spatia-label">map columns ({parsed.rows.length} rows detected)</p>
          <div className="grid grid-cols-2 gap-3">
            {CONTACT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="spatia-label text-xs">
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </label>
                <Select
                  value={mapping[field.key] ?? "__none__"}
                  onValueChange={(v) =>
                    setMapping({ ...mapping, [field.key]: (v === "__none__" || !v) ? "" : v })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="— skip —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— skip —</SelectItem>
                    {parsed.headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {parsed && previewRows.length > 0 && (
        <div className="border border-border p-5 space-y-3">
          <p className="spatia-label">preview (first 5 rows)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {CONTACT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                    <th key={f.key} className="text-left py-1.5 pr-4 spatia-label">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {CONTACT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <td key={f.key} className="py-1.5 pr-4 text-muted-foreground truncate max-w-[150px]">
                        {row[mapping[f.key]] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import button */}
      {parsed && (
        <div className="flex items-center gap-4">
          <Button
            onClick={handleImport}
            disabled={importing || !mapping.email}
          >
            {importing ? "importing..." : `import ${parsed.rows.length} contacts`}
          </Button>
          {!mapping.email && (
            <p className="text-xs text-destructive">map the email column to continue</p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
          <Check size={14} className="text-emerald-400 shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-emerald-400">{result.inserted} contacts imported.</span>
            {result.skipped > 0 && (
              <span className="text-muted-foreground ml-2">{result.skipped} skipped (already exist).</span>
            )}
          </div>
          <Link href="/crm" className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
            view crm →
          </Link>
        </div>
      )}
    </div>
  )
}
