import { createAdminClient as createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { calculateTax } from "@/lib/pricing"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  let query = supabase
    .from("invoices")
    .select("*, contacts(id, name, email, agency), shoots(id, address)")
    .order("created_at", { ascending: false })

  if (status) query = query.eq("status", status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const subtotal = body.amount - (body.discount ?? 0)
  const tax = calculateTax(subtotal)

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      shoot_id: body.shoot_id ?? null,
      contact_id: body.contact_id,
      wave_invoice_id: body.wave_invoice_id ?? null,
      amount: body.amount,
      discount: body.discount ?? 0,
      subtotal,
      gst: tax.gst,
      qst: tax.qst,
      total: tax.total,
      status: body.status ?? "sent",
      due_at: body.due_at ?? null,
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

  if (updates.status === "paid" && !updates.paid_at) {
    updates.paid_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
