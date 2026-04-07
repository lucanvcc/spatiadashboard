import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

// Formspree posts to this endpoint after form submission
export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { name, email, phone, message, property_address } = body

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 })
  }

  // Check for existing contact
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .single()

  let contactId: string

  if (existing) {
    contactId = existing.id
  } else {
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        name: name?.trim() ?? email,
        email: email.toLowerCase().trim(),
        phone: phone?.trim() ?? null,
        source: "formspree",
        status: "new_lead",
        consent_basis: "explicit_website_form",
        tags: ["website-inquiry"],
      })
      .select("id")
      .single()

    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 })
    }
    contactId = created.id
  }

  // Create note with form content
  const noteContent = [
    property_address ? `Propriété: ${property_address}` : null,
    message ? `Message: ${message}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  if (noteContent) {
    await supabase.from("notes").insert({
      contact_id: contactId,
      content: noteContent,
      category: "website-form",
    })
  }

  return NextResponse.json({ ok: true })
}
