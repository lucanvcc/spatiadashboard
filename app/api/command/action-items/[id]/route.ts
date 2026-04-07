import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// PATCH /api/command/action-items/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json() as {
    action: "resolve" | "dismiss"
    note?: string
  }

  if (!body.action || !["resolve", "dismiss"].includes(body.action)) {
    return NextResponse.json({ error: "action must be 'resolve' or 'dismiss'" }, { status: 400 })
  }

  const now = new Date().toISOString()
  const update =
    body.action === "resolve"
      ? {
          is_resolved: true,
          resolved_at: now,
          resolved_by: "user",
          resolution_note: body.note ?? null,
          updated_at: now,
        }
      : {
          is_dismissed: true,
          dismissed_at: now,
          updated_at: now,
        }

  const { data, error } = await supabase
    .from("action_items")
    .update(update)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ action_item: data })
}
