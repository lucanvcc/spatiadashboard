import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface FeedEvent {
  timestamp: string
  type: string
  icon: string
  label: string
  description: string
  url: string | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const params = req.nextUrl.searchParams
  const limit = Math.min(parseInt(params.get("limit") ?? "50"), 100)
  const hours = Math.min(parseInt(params.get("hours") ?? "48"), 168)

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const [
    { data: emails },
    { data: shoots },
    { data: invoices },
    { data: imports },
    { data: cronLogs },
    { data: actionItems },
  ] = await Promise.all([
    supabase
      .from("outreach_emails")
      .select("id, subject, status, sent_at, contacts(name)")
      .not("status", "eq", "draft")
      .gte("sent_at", since)
      .order("sent_at", { ascending: false })
      .limit(20),

    supabase
      .from("shoots")
      .select("id, address, status, updated_at, contacts(name)")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(15),

    supabase
      .from("invoices")
      .select("id, total, status, paid_at, wave_invoice_id, contacts(name)")
      .eq("status", "paid")
      .gte("paid_at", since)
      .order("paid_at", { ascending: false })
      .limit(10),

    supabase
      .from("import_batches")
      .select("id, filename, uploaded_at, total_rows, matched_rows, status")
      .gte("uploaded_at", since)
      .order("uploaded_at", { ascending: false })
      .limit(10),

    supabase
      .from("cron_logs")
      .select("id, job_name, status, result_summary, ran_at, duration_ms")
      .gte("ran_at", since)
      .order("ran_at", { ascending: false })
      .limit(20),

    supabase
      .from("action_items")
      .select("id, type, title, severity, created_at, is_resolved, resolved_at, related_url")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(15),
  ])

  const events: FeedEvent[] = []

  // Emails
  for (const email of emails ?? []) {
    const contactName =
      email.contacts && !Array.isArray(email.contacts)
        ? (email.contacts as { name: string }).name
        : null
    const statusLabel =
      email.status === "replied" ? "répondu" :
      email.status === "opened" ? "ouvert" :
      email.status === "bounced" ? "bounced" : "envoyé"
    events.push({
      timestamp: email.sent_at ?? new Date().toISOString(),
      type: "email",
      icon: "mail",
      label: `Courriel ${statusLabel}: ${contactName ?? email.subject}`,
      description: email.subject,
      url: "/outreach",
    })
  }

  // Shoots
  for (const shoot of shoots ?? []) {
    const contactName =
      shoot.contacts && !Array.isArray(shoot.contacts)
        ? (shoot.contacts as { name: string }).name
        : null
    const statusLabel =
      shoot.status === "delivered" ? "livré" :
      shoot.status === "booked" ? "réservé" :
      shoot.status === "paid" ? "payé" :
      shoot.status === "shot" ? "shooté" : shoot.status
    events.push({
      timestamp: shoot.updated_at,
      type: "shoot",
      icon: "camera",
      label: `Shoot ${statusLabel}: ${shoot.address}`,
      description: contactName ?? shoot.address,
      url: "/operations/shoots",
    })
  }

  // Invoices paid
  for (const invoice of invoices ?? []) {
    const contactName =
      invoice.contacts && !Array.isArray(invoice.contacts)
        ? (invoice.contacts as { name: string }).name
        : null
    const label = invoice.wave_invoice_id ?? invoice.id.slice(0, 8)
    events.push({
      timestamp: invoice.paid_at ?? new Date().toISOString(),
      type: "invoice",
      icon: "dollar-sign",
      label: `Facture payée: #${label}`,
      description: `${contactName ? `${contactName} — ` : ""}$${invoice.total}`,
      url: `/money/invoices/${invoice.id}`,
    })
  }

  // Imports
  for (const imp of imports ?? []) {
    events.push({
      timestamp: imp.uploaded_at,
      type: "import",
      icon: "upload",
      label: `Import: ${imp.filename}`,
      description: `${imp.matched_rows ?? 0}/${imp.total_rows ?? 0} lignes traitées`,
      url: "/money/import-wave",
    })
  }

  // Cron logs
  for (const log of cronLogs ?? []) {
    const isError = log.status === "error"
    events.push({
      timestamp: log.ran_at,
      type: isError ? "cron_error" : "cron",
      icon: isError ? "alert-circle" : "clock",
      label: `Cron: ${log.job_name}${isError ? " ✗" : " ✓"}`,
      description: (log.result_summary ?? "").slice(0, 80),
      url: "/settings/cron",
    })
  }

  // Action items created / resolved
  for (const item of actionItems ?? []) {
    if (item.is_resolved && item.resolved_at) {
      events.push({
        timestamp: item.resolved_at,
        type: "action_resolved",
        icon: "check-circle",
        label: `Résolu: ${item.title}`,
        description: item.title,
        url: item.related_url ?? "/command",
      })
    } else {
      events.push({
        timestamp: item.created_at,
        type: "action_created",
        icon: "bell",
        label: `Nouvelle action: ${item.title}`,
        description: item.title,
        url: item.related_url ?? "/command",
      })
    }
  }

  // Sort by timestamp desc, take limit
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({ events: events.slice(0, limit) })
}
