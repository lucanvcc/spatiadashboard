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
  const fullBody = body + UNSUBSCRIBE_LINE

  return transporter.sendMail({
    from: `"Luca — Spatia" <${process.env.ZOHO_SMTP_USER}>`,
    to,
    subject,
    text: fullBody,
  })
}
