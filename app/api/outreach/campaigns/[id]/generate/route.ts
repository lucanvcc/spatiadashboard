import { createAdminClient as createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Tu es le copywriter de Spatia, un studio de visites virtuelles 3D sur la Rive-Sud de Montréal. Tu rédiges des courriels de prospection courts, naturels, en français québécois. Commence toujours par un compliment spécifique sur une propriété récente de l'agent. Maximum 4-5 phrases. Ton casual et humain, jamais corporatif. Ne mentionne JAMAIS que Spatia est nouveau ou en train de bâtir un portfolio.`

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await req.json()
  const { contact_ids, template_hint } = body as {
    contact_ids?: string[]
    template_hint?: string
  }

  // Fetch campaign
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single()

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  // Fetch target contacts
  let contactQuery = supabase.from("contacts").select("*")
  if (contact_ids && contact_ids.length > 0) {
    contactQuery = contactQuery.in("id", contact_ids)
  } else {
    // Apply campaign target_criteria filters
    const criteria = campaign.target_criteria ?? {}
    if (criteria.agency) contactQuery = contactQuery.ilike("agency", `%${criteria.agency}%`)
    if (criteria.area) contactQuery = contactQuery.contains("areas_served", [criteria.area])
    if (criteria.status) contactQuery = contactQuery.eq("status", criteria.status)
    contactQuery = contactQuery.limit(20)
  }

  const { data: contacts } = await contactQuery
  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: "No contacts matched the criteria" }, { status: 400 })
  }

  // Generate email drafts for each contact
  const drafts: { contact_id: string; subject: string; body: string }[] = []

  for (const contact of contacts) {
    const userPrompt = `Agent: ${contact.name}
Agence: ${contact.agency ?? "inconnue"}
Zone: ${contact.areas_served?.join(", ") ?? "Rive-Sud"}
${template_hint ? `\nContexte supplémentaire: ${template_hint}` : ""}

Rédige un courriel de prospection court pour cet agent immobilier. Génère UNIQUEMENT:
SUJET: [ligne de sujet courte, max 6 mots]
CORPS: [corps du courriel, 4-5 phrases max]`

    try {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      })

      const text = message.content[0].type === "text" ? message.content[0].text : ""
      const subjectMatch = text.match(/SUJET:\s*(.+)/i)
      const bodyMatch = text.match(/CORPS:\s*([\s\S]+)/i)

      const subject = subjectMatch?.[1]?.trim() ?? `Visite virtuelle pour ${contact.name}`
      const emailBody = bodyMatch?.[1]?.trim() ?? text

      drafts.push({ contact_id: contact.id, subject, body: emailBody })
    } catch {
      // Skip this contact on API error
      continue
    }
  }

  if (drafts.length === 0) {
    return NextResponse.json({ error: "Failed to generate any drafts" }, { status: 500 })
  }

  // Insert all drafts as pending_review emails
  const toInsert = drafts.map((d) => ({
    contact_id: d.contact_id,
    campaign_id: id,
    subject: d.subject,
    body: d.body,
    status: "pending_review",
    created_at: new Date().toISOString(),
  }))

  const { data: inserted, error } = await supabase
    .from("outreach_emails")
    .insert(toInsert)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ generated: inserted?.length ?? 0, drafts: inserted })
}
