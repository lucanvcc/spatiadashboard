import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// CSV header aliases → contact field
const FIELD_MAP: Record<string, string> = {
  name: "name", nom: "name",
  email: "email", courriel: "email",
  phone: "phone", telephone: "phone", téléphone: "phone",
  agency: "agency", agence: "agency", brokerage: "agency", courtage: "agency",
  area: "area", region: "area", région: "area", areas_served: "area",
  notes: "notes",
  source: "source",
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""))

  return lines.slice(1).map((line) => {
    const values: string[] = []
    let current = ""
    let inQuotes = false
    for (const ch of line + ",") {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === "," && !inQuotes) { values.push(current.trim()); current = "" }
      else { current += ch }
    }
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      const field = FIELD_MAP[header] ?? header
      row[field] = values[idx] ?? ""
    })
    return row
  })
}

export async function POST(req: NextRequest) {
  // Auth check
  const serverClient = await createServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const contentType = req.headers.get("content-type") ?? ""
  let rows: Record<string, string>[] = []

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    rows = parseCSV(await file.text())
  } else {
    const body = await req.json() as { contacts?: Record<string, string>[] }
    rows = body.contacts ?? []
  }

  const valid = rows.filter((r) => r.email?.trim())
  const errCount = rows.length - valid.length

  if (valid.length === 0) {
    return NextResponse.json({ imported: 0, duplicates: 0, errors: errCount })
  }

  const emails = valid.map((r) => r.email.trim().toLowerCase())
  const { data: existing } = await supabase
    .from("contacts")
    .select("email")
    .in("email", emails)

  const existingEmails = new Set(
    (existing ?? []).map((e: { email: string }) => e.email.toLowerCase())
  )

  const toInsert = valid
    .filter((r) => !existingEmails.has(r.email.trim().toLowerCase()))
    .map((r) => ({
      name: r.name?.trim() || r.email.trim(),
      email: r.email.trim().toLowerCase(),
      phone: r.phone?.trim() || null,
      agency: r.agency?.trim() || null,
      areas_served: r.area?.trim() ? [r.area.trim()] : [],
      source: (["realtor_scrape","instagram_dm","referral","manual","formspree","cold_email"].includes(r.source?.trim())
        ? r.source.trim() : "manual") as "manual",
      notes: r.notes?.trim() || null,
      status: "new_lead",
      consent_basis: "implied_b2b_public_listing",
      tags: [],
    }))

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, duplicates: existingEmails.size, errors: errCount })
  }

  const { data, error } = await supabase.from("contacts").insert(toInsert).select("id")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    imported: data?.length ?? 0,
    duplicates: existingEmails.size,
    errors: errCount,
    total: rows.length,
  })
}
