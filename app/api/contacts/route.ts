import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const search = searchParams.get("q")

  let query = supabase
    .from("contacts")
    .select("*")
    .order("updated_at", { ascending: false })

  if (status) query = query.eq("status", status)
  if (search) query = query.ilike("name", `%${search}%`)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      ...body,
      status: body.status ?? "new_lead",
      consent_basis: body.consent_basis ?? "implied_b2b_public_listing",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
