import { sendEmail } from "@/lib/email"
import { NextResponse } from "next/server"

// POST /api/settings/email/test — send a test email to yourself
export async function POST() {
  const smtpUser = process.env.ZOHO_SMTP_USER
  if (!smtpUser) {
    return NextResponse.json(
      { error: "ZOHO_SMTP_USER is not set in .env.local" },
      { status: 400 }
    )
  }
  if (!process.env.ZOHO_SMTP_PASSWORD) {
    return NextResponse.json(
      { error: "ZOHO_SMTP_PASSWORD is not set in .env.local" },
      { status: 400 }
    )
  }

  try {
    await sendEmail({
      to: smtpUser,
      subject: "Spatia — SMTP test",
      body: "This is a test email from your Spatia dashboard.\n\nIf you received this, your Zoho SMTP config is working correctly.",
    })
    return NextResponse.json({ ok: true, sent_to: smtpUser })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
