import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { contacts } = await req.json() as {
    contacts: Array<{
      name?: string
      email?: string
      phone?: string
      agency?: string
      area?: string
      source?: string
      notes?: string
    }>
  }

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: "No contacts provided" }, { status: 400 })
  }

  // Filter out contacts without email
  const valid = contacts.filter((c) => c.email?.trim())

  // Get existing emails to deduplicate
  const emails = valid.map((c) => c.email!.trim().toLowerCase())
  const { data: existing } = await supabase
    .from("contacts")
    .select("email")
    .in("email", emails)

  const existingEmails = new Set((existing ?? []).map((e: { email: string }) => e.email.toLowerCase()))

  const toInsert = valid
    .filter((c) => !existingEmails.has(c.email!.trim().toLowerCase()))
    .map((c) => ({
      name: c.name?.trim() ?? "",
      email: c.email!.trim().toLowerCase(),
      phone: c.phone?.trim() ?? null,
      agency: c.agency?.trim() ?? null,
      areas_served: c.area?.trim() ? [c.area.trim()] : [],
      source: "manual" as const,
      notes: c.notes?.trim() ?? null,
      status: "new_lead",
      consent_basis: "implied_b2b_public_listing",
      tags: [],
    }))

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: valid.length, message: "All contacts already exist" })
  }

  const { data, error } = await supabase.from("contacts").insert(toInsert).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    inserted: data?.length ?? 0,
    skipped: valid.length - (data?.length ?? 0),
    duplicates: existingEmails.size,
  })
}
