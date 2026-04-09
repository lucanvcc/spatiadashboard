import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { parse } from "csv-parse/sync"
import type { ImportSourceType } from "@/types"

// ─── Column normalisation ──────────────────────────────────────────────────

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[\s#\-./]+/g, "_").trim()
}

function normalizeRow(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = (v ?? "").trim()
  }
  return out
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[normalizeKey(k)]
    if (v !== undefined && v !== "") return v
  }
  return ""
}

function parseAmount(s: string): number {
  if (!s) return 0
  const clean = s.replace(/[$,\s]/g, "").replace("(", "-").replace(")", "")
  return parseFloat(clean) || 0
}

function parseDate(s: string): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

// ─── Wave status → invoice status ─────────────────────────────────────────

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled"

function mapWaveStatus(waveStatus: string): InvoiceStatus {
  const s = waveStatus.toLowerCase().trim()
  if (s === "paid") return "paid"
  if (s === "sent" || s === "viewed" || s === "approved") return "sent"
  if (s === "overdue") return "overdue"
  if (s === "draft") return "draft"
  if (s === "cancelled" || s === "voided") return "cancelled"
  return "draft"
}

// ─── Expense category keyword map ─────────────────────────────────────────

function categorizeExpense(description: string, waveCategory?: string): string {
  const text = `${description} ${waveCategory ?? ""}`.toLowerCase()
  if (text.includes("matterport")) return "matterport_subscription"
  if (
    text.includes("meta ") ||
    text.includes("facebook") ||
    text.includes("instagram") ||
    text.includes("google ads") ||
    text.includes("advertising") ||
    text.includes("promoted")
  )
    return "marketing"
  if (
    text.includes("software") ||
    text.includes("subscription") ||
    text.includes("saas") ||
    text.includes("adobe") ||
    text.includes("notion") ||
    text.includes("slack")
  )
    return "software"
  if (
    text.includes("camera") ||
    text.includes("lens") ||
    text.includes("ricoh") ||
    text.includes("theta") ||
    text.includes("equipment") ||
    text.includes("hardware")
  )
    return "equipment"
  if (
    text.includes("fuel") ||
    text.includes("gas") ||
    text.includes("travel") ||
    text.includes("parking") ||
    text.includes("transit") ||
    text.includes("transport")
  )
    return "travel"
  return "other"
}

// ─── POST /api/money/import-wave ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const sourceType = (formData.get("source_type") as ImportSourceType) ?? "wave_invoices"

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  if (!["wave_invoices", "wave_expenses"].includes(sourceType)) {
    return NextResponse.json({ error: "Invalid source_type" }, { status: 400 })
  }

  const csvText = await file.text()

  let records: Record<string, string>[]
  try {
    const raw = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[]
    records = raw.map(normalizeRow)
  } catch (e) {
    return NextResponse.json({ error: `CSV parse error: ${(e as Error).message}` }, { status: 400 })
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 })
  }

  // Create batch
  const { data: batch, error: batchErr } = await supabase
    .from("import_batches")
    .insert({
      filename: file.name,
      total_rows: records.length,
      status: "processing",
      source_type: sourceType,
    })
    .select()
    .single()

  if (batchErr || !batch) {
    return NextResponse.json({ error: batchErr?.message ?? "Failed to create batch" }, { status: 500 })
  }

  const batchId: string = batch.id
  let matched = 0
  let partial = 0
  let failed = 0
  let skipped = 0

  // Process each row
  for (let i = 0; i < records.length; i++) {
    const row = records[i]

    // Insert raw import row first
    const { data: rawRow, error: rawErr } = await supabase
      .from("wave_raw_imports")
      .insert({
        filename: file.name,
        row_index: i,
        row_raw: row,
        parsed_status: "pending",
        import_batch_id: batchId,
      })
      .select("id")
      .single()

    if (rawErr || !rawRow) {
      failed++
      continue
    }

    const rawRowId: string = rawRow.id

    try {
      if (sourceType === "wave_invoices") {
        await processInvoiceRow(supabase, row, rawRowId, batchId, file.name, {
          onMatched: () => matched++,
          onPartial: () => partial++,
          onFailed: () => failed++,
          onSkipped: () => skipped++,
        })
      } else {
        await processExpenseRow(supabase, row, rawRowId, batchId, {
          onMatched: () => matched++,
          onPartial: () => partial++,
          onFailed: () => failed++,
          onSkipped: () => skipped++,
        })
      }
    } catch (e) {
      failed++
      await supabase
        .from("wave_raw_imports")
        .update({ parsed_status: "failed", error_message: (e as Error).message })
        .eq("id", rawRowId)
    }
  }

  // Finalize batch
  await supabase
    .from("import_batches")
    .update({
      matched_rows: matched,
      partial_rows: partial,
      failed_rows: failed,
      skipped_rows: skipped,
      status: "completed",
    })
    .eq("id", batchId)

  return NextResponse.json({
    batchId,
    totalRows: records.length,
    matched,
    partial,
    failed,
    skipped,
  })
}

// ─── Process invoice row ──────────────────────────────────────────────────

interface Counters {
  onMatched: () => void
  onPartial: () => void
  onFailed: () => void
  onSkipped: () => void
}

async function processInvoiceRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: Record<string, string>,
  rawRowId: string,
  batchId: string,
  filename: string,
  counters: Counters
) {
  const waveInvoiceId = pick(
    row,
    "invoice_number",
    "invoice_#",
    "invoice_no",
    "number",
    "invoice"
  )
  const customerName = pick(row, "customer", "customer_name", "client", "bill_to")
  const invoiceDateStr = pick(row, "invoice_date", "date", "issue_date", "created")
  const dueDateStr = pick(row, "due_date", "due")
  const statusStr = pick(row, "status", "invoice_status")
  const amountStr = pick(row, "subtotal", "amount", "invoice_amount", "net_amount")
  const taxStr = pick(row, "tax", "tax_total", "total_tax")
  const gstStr = pick(row, "gst", "gst_hst", "federal_tax")
  const qstStr = pick(row, "qst", "pst", "provincial_tax")
  const notesStr = pick(row, "memo", "notes", "description", "message")

  // Skip header/summary rows
  if (!waveInvoiceId && !customerName) {
    counters.onSkipped()
    await supabase
      .from("wave_raw_imports")
      .update({ parsed_status: "skipped" })
      .eq("id", rawRowId)
    return
  }

  const invoiceDate = parseDate(invoiceDateStr)
  const dueDate = parseDate(dueDateStr)
  const invoiceStatus = mapWaveStatus(statusStr)
  const subtotal = parseAmount(amountStr)

  // Parse tax
  let gst = parseAmount(gstStr)
  let qst = parseAmount(qstStr)
  const taxTotal = parseAmount(taxStr)
  if (gst === 0 && qst === 0 && taxTotal > 0) {
    // Split combined tax by rate ratio
    const totalRate = 0.05 + 0.09975
    gst = Math.round((taxTotal * (0.05 / totalRate)) * 100) / 100
    qst = Math.round((taxTotal * (0.09975 / totalRate)) * 100) / 100
  }
  const total = subtotal + gst + qst

  // Match contact by Wave customer name
  let contactId: string | null = null
  let contactMatchStatus: ParsedStatus = "partial"

  if (customerName) {
    // Try exact wave_customer_id match first
    const { data: byWaveId } = await supabase
      .from("contacts")
      .select("id")
      .eq("wave_customer_id", customerName)
      .limit(1)

    if (byWaveId && byWaveId.length > 0) {
      contactId = byWaveId[0].id
      contactMatchStatus = "matched"
    } else {
      // Case-insensitive name match
      const { data: byName } = await supabase
        .from("contacts")
        .select("id, name")
        .ilike("name", customerName)
        .limit(1)

      if (byName && byName.length > 0) {
        contactId = byName[0].id
        contactMatchStatus = "matched"
        // Record the wave_customer_id for future lookups
        await supabase
          .from("contacts")
          .update({ wave_customer_id: customerName })
          .eq("id", contactId)
      }
    }
  }

  // Check for existing invoice with this wave_invoice_id
  let invoiceId: string | null = null
  let finalStatus: ParsedStatus = contactMatchStatus

  if (waveInvoiceId) {
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id, status, paid_at")
      .eq("wave_invoice_id", waveInvoiceId)
      .limit(1)

    if (existingInvoice && existingInvoice.length > 0) {
      // Update existing invoice
      invoiceId = existingInvoice[0].id
      const updates: Record<string, unknown> = {
        status: invoiceStatus,
        subtotal,
        gst,
        qst,
        total,
        source_system: "wave_import",
        notes: notesStr || null,
      }
      if (invoiceStatus === "paid" && !existingInvoice[0].paid_at) {
        updates.paid_at = invoiceDate ?? new Date().toISOString()
      }
      if (dueDate) updates.due_at = dueDate
      if (contactId && !existingInvoice[0].contact_id) updates.contact_id = contactId

      await supabase.from("invoices").update(updates).eq("id", invoiceId)
      finalStatus = "matched"
    } else if (contactId) {
      // Create new invoice
      const { data: newInvoice } = await supabase
        .from("invoices")
        .insert({
          contact_id: contactId,
          wave_invoice_id: waveInvoiceId,
          amount: subtotal,
          discount: 0,
          subtotal,
          gst,
          qst,
          total,
          status: invoiceStatus,
          due_at: dueDate ?? null,
          paid_at: invoiceStatus === "paid" ? (invoiceDate ?? new Date().toISOString()) : null,
          source_system: "wave_import",
          notes: notesStr || null,
        })
        .select("id")
        .single()

      if (newInvoice) {
        invoiceId = newInvoice.id
        finalStatus = "matched"
      }
    } else {
      // No contact matched — partial, will need manual linking
      // Create invoice without contact_id? No — require contact. Mark as partial.
      finalStatus = "partial"
    }
  } else {
    finalStatus = "partial"
  }

  // Create revenue event for paid invoices
  if (invoiceStatus === "paid" && invoiceId && contactId) {
    const eventDate = invoiceDate ?? new Date().toISOString().slice(0, 10)

    // Check if revenue event already exists for this invoice
    const { data: existingEvent } = await supabase
      .from("revenue_events")
      .select("id")
      .eq("invoice_id", invoiceId)
      .limit(1)

    if (!existingEvent || existingEvent.length === 0) {
      await supabase.from("revenue_events").insert({
        source: "organic",
        contact_id: contactId,
        invoice_id: invoiceId,
        amount: total,
        date: eventDate,
        wave_import_batch_id: batchId,
        notes: `Wave import: ${waveInvoiceId ?? filename}`,
      })
    }
  }

  // Update raw import row
  await supabase
    .from("wave_raw_imports")
    .update({
      parsed_status: finalStatus,
      matched_invoice_id: invoiceId,
      matched_contact_id: contactId,
    })
    .eq("id", rawRowId)

  if (finalStatus === "matched") counters.onMatched()
  else if (finalStatus === "partial") counters.onPartial()
  else counters.onFailed()
}

// ─── Process expense row ──────────────────────────────────────────────────

async function processExpenseRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: Record<string, string>,
  rawRowId: string,
  batchId: string,
  counters: Counters
) {
  const dateStr = pick(row, "date", "transaction_date", "posting_date")
  const description = pick(
    row,
    "description",
    "merchant",
    "name",
    "memo",
    "particulars"
  )
  const amountStr = pick(row, "amount", "debit", "expense_amount")
  const waveCategory = pick(row, "category", "account_category", "account")
  const taxStr = pick(row, "tax", "gst", "hst", "gst_hst")
  const transactionId = pick(row, "transaction_id", "id", "reference")
  const vendor = pick(row, "vendor", "merchant", "supplier")

  if (!dateStr && !description) {
    counters.onSkipped()
    await supabase
      .from("wave_raw_imports")
      .update({ parsed_status: "skipped" })
      .eq("id", rawRowId)
    return
  }

  const date = parseDate(dateStr)
  if (!date) {
    counters.onFailed()
    await supabase
      .from("wave_raw_imports")
      .update({
        parsed_status: "failed",
        error_message: `Could not parse date: "${dateStr}"`,
      })
      .eq("id", rawRowId)
    return
  }

  const amount = Math.abs(parseAmount(amountStr))
  if (amount === 0) {
    counters.onSkipped()
    await supabase
      .from("wave_raw_imports")
      .update({ parsed_status: "skipped" })
      .eq("id", rawRowId)
    return
  }

  const taxAmount = parseAmount(taxStr)
  // Estimate GST/QST split from combined tax
  const totalRate = 0.05 + 0.09975
  const gstPaid =
    taxAmount > 0 ? Math.round((taxAmount * (0.05 / totalRate)) * 100) / 100 : 0
  const qstPaid =
    taxAmount > 0 ? Math.round((taxAmount * (0.09975 / totalRate)) * 100) / 100 : 0

  const category = categorizeExpense(description, waveCategory)
  const finalTransactionId = transactionId || null

  // Check for duplicate by wave_transaction_id
  if (finalTransactionId) {
    const { data: existing } = await supabase
      .from("expenses")
      .select("id")
      .eq("wave_transaction_id", finalTransactionId)
      .limit(1)

    if (existing && existing.length > 0) {
      counters.onSkipped()
      await supabase
        .from("wave_raw_imports")
        .update({ parsed_status: "skipped" })
        .eq("id", rawRowId)
      return
    }
  }

  await supabase.from("expenses").insert({
    date,
    category,
    description: description || waveCategory || "Imported expense",
    amount,
    gst_paid: gstPaid,
    qst_paid: qstPaid,
    vendor: vendor || null,
    source_system: "wave_import",
    wave_transaction_id: finalTransactionId,
    import_batch_id: batchId,
  })

  counters.onMatched()
  await supabase
    .from("wave_raw_imports")
    .update({ parsed_status: "matched" })
    .eq("id", rawRowId)
}

type ParsedStatus = "pending" | "matched" | "partial" | "failed" | "skipped"

// ─── GET /api/money/import-wave — batch history ───────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get("limit") ?? "20", 10)

  const { data, error } = await supabase
    .from("import_batches")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
