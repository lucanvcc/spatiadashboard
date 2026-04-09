import { createAdminClient as createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ contacts: [] })

  const supabase = await createClient()
  const { data } = await supabase
    .from("contacts")
    .select("id, name, email, agency, status")
    .or(`name.ilike.%${q}%,email.ilike.%${q}%,agency.ilike.%${q}%`)
    .order("name")
    .limit(10)

  return NextResponse.json({ contacts: data ?? [] })
}
