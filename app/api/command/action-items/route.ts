import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ActionItemType, ActionItemSeverity } from "@/types/action-items"

// GET /api/command/action-items?status=active&severity=critical,warning&limit=50
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const params = req.nextUrl.searchParams
  const status = params.get("status") ?? "active"
  const severityParam = params.get("severity")
  const limit = Math.min(parseInt(params.get("limit") ?? "50"), 100)

  let query = supabase
    .from("action_items")
    .select("*")

  if (status === "active") {
    query = query.eq("is_resolved", false).eq("is_dismissed", false)
  } else if (status === "resolved") {
    query = query.eq("is_resolved", true)
  } else if (status === "dismissed") {
    query = query.eq("is_dismissed", true)
  }

  // Filter out expired items for active status
  if (status === "active") {
    const now = new Date().toISOString()
    query = query.or(`expires_at.is.null,expires_at.gt.${now}`)
  }

  if (severityParam) {
    const severities = severityParam.split(",") as ActionItemSeverity[]
    query = query.in("severity", severities)
  }

  // Sort: severity priority then created_at desc
  const severityOrder: Record<ActionItemSeverity, number> = {
    critical: 0, warning: 1, info: 2, success: 3
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort client-side by severity then date
  const sorted = (data ?? []).sort((a, b) => {
    const sa = severityOrder[a.severity as ActionItemSeverity] ?? 3
    const sb = severityOrder[b.severity as ActionItemSeverity] ?? 3
    if (sa !== sb) return sa - sb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return NextResponse.json({ action_items: sorted })
}

// POST /api/command/action-items — manual action item creation
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json() as {
    type?: ActionItemType
    severity?: ActionItemSeverity
    title?: string
    description?: string
    related_url?: string
  }

  if (!body.title) {
    return NextResponse.json({ error: "title required" }, { status: 400 })
  }

  const { data, error } = await supabase.from("action_items").insert({
    type: body.type ?? "custom",
    severity: body.severity ?? "info",
    title: body.title,
    description: body.description ?? null,
    related_url: body.related_url ?? null,
    source: "manual",
    is_resolved: false,
    is_dismissed: false,
    updated_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ action_item: data }, { status: 201 })
}
