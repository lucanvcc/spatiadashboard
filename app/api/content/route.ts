import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month") // YYYY-MM

  let query = supabase
    .from("content_calendar")
    .select("*")
    .order("scheduled_at", { ascending: true })

  if (month) {
    const start = `${month}-01`
    const [y, m] = month.split("-").map(Number)
    const end = new Date(y, m, 0).toISOString().split("T")[0]
    query = query.gte("scheduled_at", start).lte("scheduled_at", end)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from("content_calendar")
    .insert({
      platform: body.platform ?? "instagram",
      content_type: body.content_type ?? "post",
      pillar: body.pillar,
      caption_fr: body.caption_fr ?? null,
      caption_en: body.caption_en ?? null,
      media_url: body.media_url ?? null,
      scheduled_at: body.scheduled_at ?? null,
      status: body.status ?? "draft",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { id, ...updates } = body

  const { data, error } = await supabase
    .from("content_calendar")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { error } = await supabase.from("content_calendar").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
