import { NextRequest, NextResponse } from "next/server"
import { createAdminClient as createClient } from "@/lib/supabase/server"
import { parse } from "csv-parse/sync"

// ─── Column normalisation ──────────────────────────────────────────────────

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[\s#\-.()/]+/g, "_").trim().replace(/_+/g, "_").replace(/^_|_$/g, "")
}

function normalizeRow(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = (v ?? "").trim()
  }
  return out
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[normalizeKey(k)]
    if (v !== undefined && v !== "") return v
  }
  return ""
}

function parseAmount(s: string): number {
  if (!s) return 0
  const clean = s.replace(/[$,\s]/g, "").replace("(", "-").replace(")", "")
  return parseFloat(clean) || 0
}

function parseInt2(s: string): number {
  if (!s) return 0
  return parseInt(s.replace(/[,\s]/g, ""), 10) || 0
}

function parseDate(s: string): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

// ─── POST /api/marketing/meta/ads-import ──────────────────────────────────
// Accepts a Meta Ads Manager CSV export and upserts rows into marketing_spend.
// Supports both multipart/form-data (file upload) and application/json (array of rows).
//
// Meta CSV columns handled:
//   Campaign name, Day, Reach, Impressions, Amount spent (CAD), Clicks (all),
//   Results, Result Type, CPM (cost per 1,000 impressions), CPC (all),
//   Cost per result, Frequency

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const contentType = req.headers.get("content-type") ?? ""
  let records: Record<string, string>[] = []

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

      const csvText = await file.text()
      const raw = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Record<string, string>[]
      records = raw.map(normalizeRow)
    } else {
      const body = await req.json() as { rows?: Record<string, string>[] }
      records = (body.rows ?? []).map(normalizeRow)
    }
  } catch (e) {
    return NextResponse.json({ error: `Parse error: ${(e as Error).message}` }, { status: 400 })
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "No data rows found" }, { status: 400 })
  }

  let inserted = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < records.length; i++) {
    const row = records[i]

    try {
      const dateStr = pick(row, "day", "date", "reporting_period")
      const date = parseDate(dateStr)
      if (!date) {
        skipped++
        continue
      }

      const campaignName = pick(row, "campaign_name", "campaign")
      const amountSpent = parseAmount(pick(row, "amount_spent_cad", "amount_spent", "spend"))
      const impressions = parseInt2(pick(row, "impressions"))
      const clicks = parseInt2(pick(row, "clicks_all", "clicks"))
      const reach = parseInt2(pick(row, "reach"))
      const results = parseInt2(pick(row, "results", "leads", "conversions"))

      // Skip summary/total rows
      if (!date && !campaignName) {
        skipped++
        continue
      }

      const { error } = await supabase.from("marketing_spend").insert({
        date,
        channel: "meta",
        campaign_name: campaignName || null,
        amount_spent: amountSpent,
        impressions: impressions || null,
        clicks: clicks || null,
        leads_generated: results || null,
        reach: reach || null,
      })

      if (error) {
        // Skip duplicate constraint violations silently
        if (error.code === "23505") {
          skipped++
        } else {
          failed++
          errors.push(`Row ${i + 1}: ${error.message}`)
        }
      } else {
        inserted++
      }
    } catch (e) {
      failed++
      errors.push(`Row ${i + 1}: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({
    total: records.length,
    inserted,
    skipped,
    failed,
    ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
  }, { status: inserted > 0 ? 201 : 200 })
}
