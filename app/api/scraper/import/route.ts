import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ScrapedAgent } from "@/lib/scraper/realtor-ca"

interface ImportPayload {
  agents: ScrapedAgent[]
  scrape_log_id?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { agents, scrape_log_id } = (await req.json()) as ImportPayload

  if (!Array.isArray(agents) || agents.length === 0) {
    return NextResponse.json({ error: "No agents provided" }, { status: 400 })
  }

  const results = {
    imported: 0,
    skipped_duplicate: 0,
    errors: 0,
    contact_ids: [] as string[],
  }

  for (const agent of agents) {
    if (!agent.name || !agent.phone) {
      // Skip agents with no usable contact info (no email AND no phone)
      if (!agent.email && !agent.phone) {
        results.errors++
        continue
      }
    }

    // Build a synthetic email if none — required by schema unique constraint
    // Use realtor_id as a stable identifier when email is unknown
    const email = agent.email ?? `noemail+realtor${agent.realtor_id ?? Date.now()}@spatia.internal`

    const contactPayload = {
      name: agent.name,
      email,
      phone: agent.phone,
      agency: agent.brokerage,
      areas_served: agent.areas_served.length ? agent.areas_served : null,
      source: "realtor_scrape" as const,
      status: "new_lead" as const,
      consent_basis: "publicly_listed_business_contact",
      tags: ["realtor-ca-scraper"],
      notes: agent.profile_url ? `Realtor.ca profile: ${agent.profile_url}` : null,
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert(contactPayload)
      .select("id")
      .single()

    if (error) {
      if (error.code === "23505") {
        // Unique violation — already in CRM
        results.skipped_duplicate++
      } else {
        results.errors++
      }
    } else if (data) {
      results.imported++
      results.contact_ids.push(data.id)
    }
  }

  // Update scrape_log imported_count
  if (scrape_log_id) {
    await supabase
      .from("scrape_logs")
      .update({ imported_count: results.imported })
      .eq("id", scrape_log_id)
  }

  return NextResponse.json(results)
}
