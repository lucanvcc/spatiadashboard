import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
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

type SocialPlatform = "instagram" | "tiktok" | "youtube" | "linkedin" | "facebook" | "other"

function detectPlatform(row: Record<string, string>, fallback: SocialPlatform): SocialPlatform {
  const platform = pick(row, "platform", "network", "source").toLowerCase()
  if (platform.includes("instagram")) return "instagram"
  if (platform.includes("tiktok")) return "tiktok"
  if (platform.includes("youtube")) return "youtube"
  if (platform.includes("linkedin")) return "linkedin"
  if (platform.includes("facebook")) return "facebook"
  return fallback
}

// ─── POST /api/marketing/meta/organic-import ──────────────────────────────
// Accepts an Instagram Insights (or other platform) CSV export and upserts
// rows into social_post_metrics.
//
// Columns handled (Instagram Insights export format):
//   Post ID, Date, Platform, Impressions, Reach, Likes, Comments, Saves, Shares,
//   Profile visits, Content calendar ID (optional)
//
// Also accepts multipart/form-data with optional platform query param
// (defaults to "instagram").

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const defaultPlatform = (searchParams.get("platform") ?? "instagram") as SocialPlatform

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
      const body = await req.json() as { rows?: Record<string, string>[]; platform?: SocialPlatform }
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
      const dateStr = pick(row, "date", "day", "post_date", "published_at")
      const date = parseDate(dateStr)
      if (!date) {
        skipped++
        continue
      }

      const postId = pick(row, "post_id", "id", "media_id") || null
      const platform = detectPlatform(row, defaultPlatform)
      const likes = parseInt2(pick(row, "likes", "like_count"))
      const comments = parseInt2(pick(row, "comments", "comment_count"))
      const saves = parseInt2(pick(row, "saves", "saved"))
      const shares = parseInt2(pick(row, "shares", "share_count"))
      const reach = parseInt2(pick(row, "reach")) || null
      const impressions = parseInt2(pick(row, "impressions")) || null
      const profileVisits = parseInt2(pick(row, "profile_visits", "profile_activity")) || null
      const contentCalendarId = pick(row, "content_calendar_id") || null

      // Skip rows with no meaningful data
      if (!likes && !comments && !saves && !shares && !reach && !impressions) {
        skipped++
        continue
      }

      const { error } = await supabase.from("social_post_metrics").insert({
        date,
        platform,
        post_id: postId,
        content_calendar_id: contentCalendarId,
        likes,
        comments,
        saves,
        shares,
        reach,
        impressions,
        profile_visits: profileVisits,
      })

      if (error) {
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
