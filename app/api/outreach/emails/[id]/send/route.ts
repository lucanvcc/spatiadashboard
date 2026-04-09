import { createAdminClient as createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email"
import { NextRequest, NextResponse } from "next/server"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Fetch email + contact
  const { data: email, error: fetchError } = await supabase
    .from("outreach_emails")
    .select("*, contacts(id, name, email, status)")
    .eq("id", id)
    .single()

  if (fetchError || !email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 })
  }

  const contact = email.contacts as { id: string; name: string; email: string; status: string }
  if (!contact?.email) {
    return NextResponse.json({ error: "Contact has no email address" }, { status: 400 })
  }

  try {
    await sendEmail({
      to: contact.email,
      subject: email.subject,
      body: email.body,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "SMTP error"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const now = new Date().toISOString()

  // Update email status
  await supabase
    .from("outreach_emails")
    .update({ status: "sent", sent_at: now })
    .eq("id", id)

  // Advance contact status if still at new_lead or researched
  if (["new_lead", "researched"].includes(contact.status)) {
    await supabase
      .from("contacts")
      .update({ status: "first_email_sent" })
      .eq("id", contact.id)
  }

  return NextResponse.json({ ok: true, sent_at: now })
}
