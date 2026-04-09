import { createAdminClient as createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const campaignId = searchParams.get("campaign_id")

  let query = supabase
    .from("outreach_emails")
    .select("*, contacts(id, name, email, agency), campaigns(id, name)")
    .order("created_at", { ascending: false })
    .limit(100)

  if (status) query = query.eq("status", status)
  if (campaignId) query = query.eq("campaign_id", campaignId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from("outreach_emails")
    .insert({
      ...body,
      status: "pending_review",
      created_at: new Date().toISOString(),
    })
    .select("*, contacts(id, name, email, agency), campaigns(id, name)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
