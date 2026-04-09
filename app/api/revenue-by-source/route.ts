import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  // Primary: paid invoices joined with contact source for automatic attribution
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("total, contacts(source)")
    .eq("status", "paid")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bySource: Record<string, number> = {}
  for (const inv of invoices ?? []) {
    const contact = inv.contacts as { source?: string } | null
    const source = contact?.source ?? "manual"
    // Map contact_source to display labels
    const label =
      source === "realtor_scrape" ? "cold_email" :
      source === "formspree" ? "formspree" :
      source === "instagram_dm" ? "instagram_dm" :
      source === "referral" ? "referral" :
      source === "cold_email" ? "cold_email" :
      "organic"
    bySource[label] = (bySource[label] ?? 0) + (inv.total ?? 0)
  }

  // Supplement with manual revenue_events (if any exist with manual entries)
  const { data: events } = await supabase
    .from("revenue_events")
    .select("source, amount")
  for (const r of events ?? []) {
    bySource[r.source] = (bySource[r.source] ?? 0) + (r.amount ?? 0)
  }

  return NextResponse.json(
    Object.entries(bySource)
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount)
  )
}
