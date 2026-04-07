import { runCronJob, getSupabaseAdmin } from "./run-job"
import { upsertActionItem } from "@/lib/action-items"

export async function runFollowupReminder() {
  return runCronJob("followup-reminder", async () => {
    const supabase = getSupabaseAdmin()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("id, name, email, agency, status")
      .eq("status", "first_email_sent")

    if (error) throw new Error(error.message)
    if (!contacts || contacts.length === 0) {
      return { summary: "no contacts in first_email_sent stage", actionItemsCreated: 0 }
    }

    let flagged = 0
    let actionItemsCreated = 0

    for (const contact of contacts) {
      // Check most recent sent email for this contact
      const { data: emails } = await supabase
        .from("outreach_emails")
        .select("sent_at, status")
        .eq("contact_id", contact.id)
        .eq("is_followup", false)
        .order("sent_at", { ascending: false })
        .limit(1)

      if (!emails || emails.length === 0) continue
      const lastEmail = emails[0]
      if (!lastEmail.sent_at) continue

      const sentAt = new Date(lastEmail.sent_at)
      if (sentAt > sevenDaysAgo) continue

      const daysSince = Math.floor(
        (Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Check if already replied
      const { data: replies } = await supabase
        .from("outreach_emails")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("status", "replied")
        .limit(1)

      if (replies && replies.length > 0) continue

      // Add followup_due tag if not already set
      const { data: current } = await supabase
        .from("contacts")
        .select("tags")
        .eq("id", contact.id)
        .single()

      const tags: string[] = current?.tags ?? []
      if (!tags.includes("followup_due")) {
        await supabase
          .from("contacts")
          .update({
            tags: [...tags, "followup_due"],
            updated_at: new Date().toISOString(),
          })
          .eq("id", contact.id)
        flagged++
      }

      // Write action_item
      const created = await upsertActionItem({
        type: "followup_due",
        severity: "warning",
        title: `Relance: ${contact.name}`,
        description: `Premier courriel envoyé il y a ${daysSince} jours, aucune réponse.`,
        related_entity_type: "contact",
        related_entity_id: contact.id,
        related_url: `/crm?contact=${contact.id}`,
        source: "cron:followup_reminder",
        data: {
          contact_name: contact.name,
          contact_email: contact.email,
          agency: contact.agency,
          days_since_first_email: daysSince,
          stage: contact.status,
        },
      })
      if (created) actionItemsCreated++
    }

    return {
      summary: `checked ${contacts.length} contacts, ${flagged} flagged, ${actionItemsCreated} action items created`,
      actionItemsCreated,
    }
  })
}
