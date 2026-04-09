import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const limit = parseInt(searchParams.get("limit") ?? "100", 10)

  let query = supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit)

  if (category) query = query.eq("category", category)
  if (from) query = query.gte("date", from)
  if (to) query = query.lte("date", to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: {
    date: string
    category: string
    description: string
    amount: number
    gst_paid?: number
    qst_paid?: number
    vendor?: string
    receipt_url?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.date || !body.category || !body.description || !body.amount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      date: body.date,
      category: body.category,
      description: body.description,
      amount: body.amount,
      gst_paid: body.gst_paid ?? 0,
      qst_paid: body.qst_paid ?? 0,
      vendor: body.vendor ?? null,
      receipt_url: body.receipt_url ?? null,
      source_system: "manual",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
