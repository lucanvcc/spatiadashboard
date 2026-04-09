import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// ─── Ghost Detector ────────────────────────────────────────────────────────────
// Contacts who have opened emails 3+ times but never replied — they're interested
// but hesitant. Flag for a different follow-up angle.
//
// ─── Recurring Client Detector ────────────────────────────────────────────────
// Contacts who have 2+ completed shoots — candidate for a retainer pitch.
//
// ─── Dead Lead Recycler ───────────────────────────────────────────────────────
// Contacts who were last contacted 90+ days ago and are still in early stages.

export async function GET() {
  const supabase = await createClient()
  const now = new Date()
  const since90 = new Date(now.getTime() - 90 * 86400000).toISOString()
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [
    { data: allEmails },
    { data: allShoots },
    { data: allContacts },
  ] = await Promise.all([
    supabase
      .from("outreach_emails")
      .select("id, contact_id, status, opened_at, replied_at, sent_at")
      .not("status", "eq", "draft")
      .not("sent_at", "is", null),

    supabase
      .from("shoots")
      .select("id, contact_id, status, total_price, delivered_at, scheduled_at")
      .in("status", ["delivered", "paid"]),

    supabase
      .from("contacts")
      .select("id, name, email, agency, status, updated_at")
      .not("status", "in", '("churned","paying_client")'),
  ])

  // ── Ghost detector ─────────────────────────────────────────────────────────
  // Group emails by contact
  const emailsByContact = new Map<string, typeof allEmails>()
  for (const email of allEmails ?? []) {
    if (!email.contact_id) continue
    if (!emailsByContact.has(email.contact_id)) emailsByContact.set(email.contact_id, [])
    emailsByContact.get(email.contact_id)!.push(email)
  }

  type Ghost = {
    contact_id: string
    name: string
    agency: string | null
    opens: number
    lastOpened: string | null
    emailsSent: number
  }

  const ghosts: Ghost[] = []
  for (const [contactId, emails] of emailsByContact.entries()) {
    if (!emails) continue
    const hasReplied = emails.some((e) => e.status === "replied" || e.replied_at)
    if (hasReplied) continue

    const opens = emails.filter((e) => e.opened_at).length
    if (opens < 3) continue

    const contact = (allContacts ?? []).find((c) => c.id === contactId)
    if (!contact) continue

    const openDates = emails
      .filter((e) => e.opened_at)
      .map((e) => e.opened_at!)
      .sort((a, b) => b.localeCompare(a))

    ghosts.push({
      contact_id: contactId,
      name: contact.name,
      agency: contact.agency ?? null,
      opens,
      lastOpened: openDates[0] ?? null,
      emailsSent: emails.length,
    })
  }

  // Sort by opens desc
  ghosts.sort((a, b) => b.opens - a.opens)

  // ── Recurring client detector ──────────────────────────────────────────────
  const shootsByContact = new Map<string, typeof allShoots>()
  for (const shoot of allShoots ?? []) {
    if (!shoot.contact_id) continue
    if (!shootsByContact.has(shoot.contact_id)) shootsByContact.set(shoot.contact_id, [])
    shootsByContact.get(shoot.contact_id)!.push(shoot)
  }

  type RecurringClient = {
    contact_id: string
    name: string
    agency: string | null
    shootCount: number
    totalRevenue: number
    lastShootDate: string | null
  }

  const recurringClients: RecurringClient[] = []
  for (const [contactId, shoots] of shootsByContact.entries()) {
    if (!shoots || shoots.length < 2) continue

    const contact = (allContacts ?? []).find((c) => c.id === contactId)
    // Also check paying_client status contacts with multiple shoots
    const allContactsRaw = await supabase
      .from("contacts")
      .select("id, name, agency, status")
      .eq("id", contactId)
      .single()

    const c = allContactsRaw.data ?? contact
    if (!c) continue

    const totalRevenue = shoots.reduce((s, sh) => s + (sh.total_price ?? 0), 0)
    const shootDates = shoots
      .map((s) => s.delivered_at ?? s.scheduled_at)
      .filter(Boolean)
      .sort((a, b) => (b ?? "").localeCompare(a ?? ""))

    recurringClients.push({
      contact_id: contactId,
      name: c.name,
      agency: c.agency ?? null,
      shootCount: shoots.length,
      totalRevenue,
      lastShootDate: shootDates[0] ?? null,
    })
  }

  recurringClients.sort((a, b) => b.shootCount - a.shootCount || b.totalRevenue - a.totalRevenue)

  // ── Dead lead recycler ─────────────────────────────────────────────────────
  // Contacts in early stages, not contacted in 90+ days
  const earlyStages = ["new_lead", "researched", "first_email_sent", "followup_sent"]

  type DeadLead = {
    contact_id: string
    name: string
    agency: string | null
    status: string
    daysSinceUpdate: number
    lastUpdate: string
  }

  const deadLeads: DeadLead[] = []
  for (const contact of allContacts ?? []) {
    if (!earlyStages.includes(contact.status)) continue
    const lastUpdate = contact.updated_at ?? ""
    if (!lastUpdate || lastUpdate >= since90) continue

    const daysSince = Math.floor((now.getTime() - new Date(lastUpdate).getTime()) / 86400000)
    deadLeads.push({
      contact_id: contact.id,
      name: contact.name,
      agency: contact.agency ?? null,
      status: contact.status,
      daysSinceUpdate: daysSince,
      lastUpdate,
    })
  }

  deadLeads.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)

  return NextResponse.json({
    ghosts: ghosts.slice(0, 20),
    recurringClients: recurringClients.slice(0, 20),
    deadLeads: deadLeads.slice(0, 30),
    meta: {
      ghostCount: ghosts.length,
      recurringCount: recurringClients.length,
      deadLeadCount: deadLeads.length,
    },
  })
}
