import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Returns unified calendar events: custom events + shoots + content posts
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from") // ISO date
  const to = searchParams.get("to")     // ISO date

  const [
    { data: events },
    { data: shoots },
    { data: posts },
  ] = await Promise.all([
    // Custom events (calls, meetings, tasks, etc.)
    supabase
      .from("calendar_events")
      .select("*, contacts(name)")
      .gte("starts_at", from ?? new Date(0).toISOString())
      .lte("starts_at", to ?? new Date("2099-01-01").toISOString())
      .order("starts_at"),

    // Shoots with scheduled_at
    supabase
      .from("shoots")
      .select("id, address, scheduled_at, status, total_price, contacts(name)")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", from ?? new Date(0).toISOString())
      .lte("scheduled_at", to ?? new Date("2099-01-01").toISOString())
      .order("scheduled_at"),

    // Content posts with scheduled_at
    supabase
      .from("content_calendar")
      .select("id, pillar, content_type, caption_fr, scheduled_at, status")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", from ?? new Date(0).toISOString())
      .lte("scheduled_at", to ?? new Date("2099-01-01").toISOString())
      .order("scheduled_at"),
  ])

  // Normalize to a unified shape
  const unified = [
    ...(events ?? []).map((e: any) => ({
      id: `evt_${e.id}`,
      raw_id: e.id,
      type: e.event_type,
      title: e.title,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      all_day: e.all_day,
      description: e.description,
      location: e.location,
      contact: e.contacts?.name ?? null,
      completed: e.completed,
      source: "event" as const,
    })),
    ...(shoots ?? []).map((s: any) => ({
      id: `shoot_${s.id}`,
      raw_id: s.id,
      type: "shoot",
      title: `📷 ${s.address}`,
      starts_at: s.scheduled_at,
      ends_at: null,
      all_day: false,
      description: `$${s.total_price} · ${s.status}`,
      location: s.address,
      contact: s.contacts?.name ?? null,
      completed: ["delivered", "paid"].includes(s.status),
      source: "shoot" as const,
    })),
    ...(posts ?? []).map((p: any) => ({
      id: `post_${p.id}`,
      raw_id: p.id,
      type: "post",
      title: `📱 ${p.pillar.replace("the_", "the ")} — ${p.content_type}`,
      starts_at: p.scheduled_at,
      ends_at: null,
      all_day: true,
      description: p.caption_fr ?? "",
      location: null,
      contact: null,
      completed: ["posted", "analyzed"].includes(p.status),
      source: "post" as const,
    })),
  ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

  return NextResponse.json(unified)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      title: body.title,
      event_type: body.event_type ?? "other",
      starts_at: body.starts_at,
      ends_at: body.ends_at ?? null,
      all_day: body.all_day ?? false,
      description: body.description ?? null,
      location: body.location ?? null,
      contact_id: body.contact_id ?? null,
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
    .from("calendar_events")
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

  const { error } = await supabase.from("calendar_events").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
