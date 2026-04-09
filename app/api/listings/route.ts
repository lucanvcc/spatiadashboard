import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  let query = supabase
    .from("listings")
    .select("*, contacts(id, name)")
    .order("created_at", { ascending: false })
    .limit(100)

  if (status) query = query.eq("status", status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  if (!body.address?.trim()) {
    return NextResponse.json({ error: "address is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("listings")
    .insert({
      address: body.address.trim(),
      mls_number: body.mls_number?.trim() ?? null,
      agent_name: body.agent_name?.trim() ?? null,
      contact_id: body.contact_id ?? null,
      realtor_url: body.realtor_url?.trim() ?? null,
      price: body.price ?? null,
      status: body.status ?? "active",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
