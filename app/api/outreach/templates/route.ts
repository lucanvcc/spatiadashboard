import { createAdminClient as createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { name, subject_template, body_template, language, variables_schema } = body

  if (!name?.trim() || !subject_template?.trim() || !body_template?.trim()) {
    return NextResponse.json({ error: "name, subject_template, and body_template are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      name: name.trim(),
      subject_template: subject_template.trim(),
      body_template: body_template.trim(),
      language: language ?? "fr",
      variables_schema: variables_schema ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
