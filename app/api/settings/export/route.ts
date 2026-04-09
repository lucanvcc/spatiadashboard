import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET /api/settings/export?table=contacts — returns CSV of the requested table
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const table = searchParams.get("table")

  const ALLOWED_TABLES = [
    "contacts",
    "shoots",
    "invoices",
    "tours",
    "outreach_emails",
    "campaigns",
    "content_calendar",
    "marketing_spend",
    "revenue_events",
    "notes",
    "expenses",
  ] as const

  if (!table || !ALLOWED_TABLES.includes(table as (typeof ALLOWED_TABLES)[number])) {
    return NextResponse.json(
      { error: `Invalid table. Allowed: ${ALLOWED_TABLES.join(", ")}` },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from(table).select("*").order("created_at" as never, { ascending: false }).limit(10000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return new NextResponse("", {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${table}.csv"`,
      },
    })
  }

  // Build CSV
  const headers = Object.keys(data[0])
  const rows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = (row as Record<string, unknown>)[h]
          if (val === null || val === undefined) return ""
          const str = typeof val === "object" ? JSON.stringify(val) : String(val)
          // Escape quotes and wrap in quotes if needed
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(",")
    ),
  ].join("\n")

  return new NextResponse(rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${table}_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}

// DELETE /api/settings/export?action=purge-cron-logs — danger zone actions
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")
  const supabase = await createClient()

  if (action === "purge-cron-logs") {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const { error, count } = await supabase
      .from("cron_logs")
      .delete({ count: "exact" })
      .lt("ran_at", cutoff.toISOString())
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, deleted: count ?? 0 })
  }

  if (action === "purge-dismissed-alerts") {
    const { error, count } = await supabase
      .from("alerts")
      .delete({ count: "exact" })
      .eq("dismissed", true)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, deleted: count ?? 0 })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
