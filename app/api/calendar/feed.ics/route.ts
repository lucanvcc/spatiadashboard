import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

function icsDate(iso: string): string {
  // iCal format: 20260406T120000Z
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace("Z", "Z")
}

function escapeIcs(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

function foldLine(line: string): string {
  // iCal spec: lines > 75 chars must be folded
  const out: string[] = []
  while (line.length > 75) {
    out.push(line.slice(0, 75))
    line = " " + line.slice(75)
  }
  out.push(line)
  return out.join("\r\n")
}

export async function GET() {
  const supabase = await createClient()

  const { data: shoots } = await supabase
    .from("shoots")
    .select("id, address, sq_ft, tier, total_price, status, scheduled_at, notes, contacts(name, agency)")
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true })

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Spatia Growth Command Center//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Spatia Shoots",
    "X-WR-TIMEZONE:America/Toronto",
    "X-WR-CALDESC:Shoot schedule for Studio Spatia",
    "REFRESH-INTERVAL;VALUE=DURATION:PT5M",
    "X-PUBLISHED-TTL:PT5M",
  ]

  for (const shoot of shoots ?? []) {
    if (!shoot.scheduled_at) continue

    const start = new Date(shoot.scheduled_at)
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000) // 2h default duration

    const startStr = icsDate(start.toISOString())
    const endStr = icsDate(end.toISOString())
    const now = icsDate(new Date().toISOString())

    const contact = (shoot as any).contacts
    const clientName = contact?.name ?? ""
    const agency = contact?.agency ? ` (${contact.agency})` : ""

    const summary = `📷 ${shoot.address}`
    const description = [
      clientName ? `Client: ${clientName}${agency}` : "",
      `Status: ${shoot.status}`,
      `Sq ft: ${shoot.sq_ft.toLocaleString()} — Tier ${shoot.tier}`,
      `Price: $${shoot.total_price}`,
      shoot.notes ? `Notes: ${shoot.notes}` : "",
    ]
      .filter(Boolean)
      .join("\\n")

    lines.push("BEGIN:VEVENT")
    lines.push(`UID:spatia-shoot-${shoot.id}@spatia.ca`)
    lines.push(`DTSTAMP:${now}`)
    lines.push(`DTSTART:${startStr}`)
    lines.push(`DTEND:${endStr}`)
    lines.push(foldLine(`SUMMARY:${escapeIcs(summary)}`))
    lines.push(foldLine(`DESCRIPTION:${description}`))
    lines.push(foldLine(`LOCATION:${escapeIcs(shoot.address)}`))
    lines.push(`STATUS:${shoot.status === "booked" ? "CONFIRMED" : "TENTATIVE"}`)
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")

  const body = lines.join("\r\n")

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="spatia-shoots.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}
