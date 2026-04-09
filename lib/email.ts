import nodemailer from "nodemailer"

export const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_SMTP_USER,
    pass: process.env.ZOHO_SMTP_PASSWORD,
  },
})

export const UNSUBSCRIBE_LINE =
  "\n\n---\nPour ne plus recevoir de courriels de Spatia, répondez avec « Se désabonner » / To unsubscribe, reply with \"Unsubscribe\"."

export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}) {
  const smtpUser = process.env.ZOHO_SMTP_USER
  const smtpPass = process.env.ZOHO_SMTP_PASSWORD
  if (!smtpUser || !smtpPass) {
    throw new Error(
      "[Spatia] ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD must be set to send outreach emails. " +
        "Add them to .env.local (see .env.local.example)."
    )
  }

  const fullBody = body + UNSUBSCRIBE_LINE

  return transporter.sendMail({
    from: `"Luca — Spatia" <${smtpUser}>`,
    to,
    subject,
    text: fullBody,
  })
}
