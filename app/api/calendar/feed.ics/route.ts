import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

function icsDate(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace("Z", "Z")
}

function icsDateOnly(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "")
}

function escapeIcs(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

function foldLine(line: string): string {
  const out: string[] = []
  while (line.length > 75) {
    out.push(line.slice(0, 75))
    line = " " + line.slice(75)
  }
  out.push(line)
  return out.join("\r\n")
}

function makeEvent(uid: string, summary: string, starts_at: string, ends_at: string | null, allDay: boolean, description: string, location: string | null, status: string, now: string): string[] {
  const lines: string[] = ["BEGIN:VEVENT"]
  lines.push(`UID:${uid}`)
  lines.push(`DTSTAMP:${now}`)

  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${icsDateOnly(starts_at)}`)
    const endDate = ends_at
      ? icsDateOnly(ends_at)
      : icsDateOnly(new Date(new Date(starts_at).getTime() + 86400000).toISOString())
    lines.push(`DTEND;VALUE=DATE:${endDate}`)
  } else {
    lines.push(`DTSTART:${icsDate(new Date(starts_at).toISOString())}`)
    const endIso = ends_at
      ? new Date(ends_at).toISOString()
      : new Date(new Date(starts_at).getTime() + 2 * 60 * 60 * 1000).toISOString()
    lines.push(`DTEND:${icsDate(endIso)}`)
  }

  lines.push(foldLine(`SUMMARY:${escapeIcs(summary)}`))
  if (description) lines.push(foldLine(`DESCRIPTION:${escapeIcs(description)}`))
  if (location) lines.push(foldLine(`LOCATION:${escapeIcs(location)}`))
  lines.push(`STATUS:${status}`)
  lines.push("END:VEVENT")
  return lines
}

export async function GET() {
  const supabase = await createClient()
  const now = icsDate(new Date().toISOString())

  const [
    { data: shoots },
    { data: posts },
    { data: events },
  ] = await Promise.all([
    supabase
      .from("shoots")
      .select("id, address, sq_ft, tier, total_price, status, scheduled_at, notes, contacts(name, agency)")
      .not("scheduled_at", "is", null)
      .order("scheduled_at"),

    supabase
      .from("content_calendar")
      .select("id, pillar, content_type, caption_fr, scheduled_at, status")
      .not("scheduled_at", "is", null)
      .order("scheduled_at"),

    supabase
      .from("calendar_events")
      .select("*, contacts(name)")
      .order("starts_at"),
  ])

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Spatia Growth Command Center//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Spatia",
    "X-WR-TIMEZONE:America/Toronto",
    "X-WR-CALDESC:Shoots, posts, calls and events — Studio Spatia",
    "REFRESH-INTERVAL;VALUE=DURATION:PT5M",
    "X-PUBLISHED-TTL:PT5M",
  ]

  // Shoots
  for (const s of shoots ?? []) {
    if (!s.scheduled_at) continue
    const contact = (s as any).contacts
    const clientLine = contact?.name ? `Client: ${contact.name}${contact.agency ? ` (${contact.agency})` : ""}` : ""
    const desc = [clientLine, `Status: ${s.status}`, `${s.sq_ft} sq ft — Tier ${s.tier}`, `$${s.total_price}`, s.notes ?? ""].filter(Boolean).join("\\n")
    lines.push(...makeEvent(
      `spatia-shoot-${s.id}@spatia.ca`,
      `📷 ${s.address}`,
      s.scheduled_at, null, false, desc, s.address,
      s.status === "booked" ? "CONFIRMED" : "TENTATIVE",
      now
    ))
  }

  // Content posts
  for (const p of posts ?? []) {
    if (!p.scheduled_at) continue
    const pillarLabel = p.pillar.replace("the_", "the ")
    lines.push(...makeEvent(
      `spatia-post-${p.id}@spatia.ca`,
      `📱 ${pillarLabel} — ${p.content_type}`,
      p.scheduled_at, null, true,
      p.caption_fr ? p.caption_fr.slice(0, 200) : "",
      null, "CONFIRMED", now
    ))
  }

  // Custom events (calls, meetings, tasks, other)
  for (const e of events ?? []) {
    const contact = (e as any).contacts
    const desc = [e.description ?? "", contact?.name ? `With: ${contact.name}` : "", e.location ?? ""].filter(Boolean).join("\\n")
    const emoji = { call: "📞", meeting: "🤝", task: "✓", shoot: "📷", post: "📱", other: "📅" }[e.event_type as string] ?? "📅"
    lines.push(...makeEvent(
      `spatia-event-${e.id}@spatia.ca`,
      `${emoji} ${e.title}`,
      e.starts_at, e.ends_at, e.all_day,
      desc, e.location ?? null,
      e.completed ? "CANCELLED" : "CONFIRMED",
      now
    ))
  }

  lines.push("END:VCALENDAR")

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="spatia.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}
