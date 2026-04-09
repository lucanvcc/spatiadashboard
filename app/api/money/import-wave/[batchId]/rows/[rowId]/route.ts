import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string; rowId: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { batchId, rowId } = await params

  let body: { contact_id?: string; invoice_id?: string; action: "link" | "skip" }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.action === "skip") {
    const { error } = await supabase
      .from("wave_raw_imports")
      .update({ parsed_status: "skipped" })
      .eq("id", rowId)
      .eq("import_batch_id", batchId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Recalculate batch counts
    await recalcBatch(supabase, batchId)

    return NextResponse.json({ ok: true })
  }

  if (body.action === "link") {
    const updates: Record<string, unknown> = {
      parsed_status: "matched",
    }
    if (body.contact_id) updates.matched_contact_id = body.contact_id
    if (body.invoice_id) updates.matched_invoice_id = body.invoice_id

    const { error } = await supabase
      .from("wave_raw_imports")
      .update(updates)
      .eq("id", rowId)
      .eq("import_batch_id", batchId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update the invoice / contact with the link
    if (body.invoice_id && body.contact_id) {
      await supabase
        .from("invoices")
        .update({ contact_id: body.contact_id })
        .eq("id", body.invoice_id)
        .is("contact_id", null)
    }

    await recalcBatch(supabase, batchId)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalcBatch(supabase: any, batchId: string) {
  const { data: rows } = await supabase
    .from("wave_raw_imports")
    .select("parsed_status")
    .eq("import_batch_id", batchId)

  if (!rows) return

  const matched = rows.filter((r: { parsed_status: string }) => r.parsed_status === "matched").length
  const partial = rows.filter((r: { parsed_status: string }) => r.parsed_status === "partial").length
  const failed = rows.filter((r: { parsed_status: string }) => r.parsed_status === "failed").length
  const skipped = rows.filter((r: { parsed_status: string }) => r.parsed_status === "skipped").length

  await supabase
    .from("import_batches")
    .update({ matched_rows: matched, partial_rows: partial, failed_rows: failed, skipped_rows: skipped })
    .eq("id", batchId)
}
