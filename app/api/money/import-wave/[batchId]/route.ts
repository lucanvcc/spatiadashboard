import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { batchId } = await params

  const [{ data: batch, error: batchErr }, { data: rows, error: rowsErr }] =
    await Promise.all([
      supabase.from("import_batches").select("*").eq("id", batchId).single(),
      supabase
        .from("wave_raw_imports")
        .select("*")
        .eq("import_batch_id", batchId)
        .order("row_index", { ascending: true }),
    ])

  if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 404 })
  if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 })

  return NextResponse.json({ batch, rows: rows ?? [] })
}
