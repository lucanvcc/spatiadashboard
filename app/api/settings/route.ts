import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET /api/settings — returns all settings as { key: value } map
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("settings").select("key, value")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[row.key] = row.value ?? ""
  }
  return NextResponse.json(map)
}

// PATCH /api/settings — body: { key: value, ... }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const entries = Object.entries(body as Record<string, string>)
  if (entries.length === 0) {
    return NextResponse.json({ error: "No keys provided" }, { status: 400 })
  }

  // Upsert each key individually (settings table uses text PK)
  for (const [key, value] of entries) {
    const { error } = await supabase
      .from("settings")
      .upsert({ key, value: String(value), updated_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
