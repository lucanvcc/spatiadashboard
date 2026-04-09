import { createAdminClient as createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { calculateShootPrice } from "@/lib/pricing"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  let query = supabase
    .from("shoots")
    .select("*, contacts(id, name, email, agency)")
    .order("scheduled_at", { ascending: false })

  if (status) query = query.eq("status", status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const pricing = calculateShootPrice(
    body.sq_ft,
    body.is_rush ?? false,
    body.is_travel ?? false
  )

  const { data, error } = await supabase
    .from("shoots")
    .insert({
      contact_id: body.contact_id,
      address: body.address,
      sq_ft: body.sq_ft,
      tier: pricing.tier,
      base_price: pricing.base_price,
      rush_surcharge: pricing.rush_surcharge,
      travel_surcharge: pricing.travel_surcharge,
      total_price: pricing.total_price,
      status: body.status ?? "booked",
      scheduled_at: body.scheduled_at ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
