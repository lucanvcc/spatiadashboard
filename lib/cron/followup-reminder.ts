import { runCronJob, getSupabaseAdmin } from "./run-job"

export async function runFollowupReminder() {
  return runCronJob("followup-reminder", async () => {
    const supabase = getSupabaseAdmin()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Get contacts in "first_email_sent" stage
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("id, name, email")
      .eq("status", "first_email_sent")

    if (error) throw new Error(error.message)
    if (!contacts || contacts.length === 0) return "no contacts in first_email_sent stage"

    let flagged = 0

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
      if (sentAt > sevenDaysAgo) continue // not old enough

      // Check if there's a reply
      const { data: replies } = await supabase
        .from("outreach_emails")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("status", "replied")
        .limit(1)

      if (replies && replies.length > 0) continue // already replied

      // Check if followup_due tag already set
      const { data: current } = await supabase
        .from("contacts")
        .select("tags")
        .eq("id", contact.id)
        .single()

      const tags: string[] = current?.tags ?? []
      if (tags.includes("followup_due")) continue

      // Add followup_due tag
      await supabase
        .from("contacts")
        .update({
          tags: [...tags, "followup_due"],
          updated_at: new Date().toISOString(),
        })
        .eq("id", contact.id)

      flagged++
    }

    return `checked ${contacts.length} contacts, ${flagged} flagged for follow-up`
  })
}
