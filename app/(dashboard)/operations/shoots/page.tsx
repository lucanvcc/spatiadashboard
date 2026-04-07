import { createClient } from "@/lib/supabase/server"
import { ShootsList } from "@/components/operations/shoots-list"
import { headers } from "next/headers"
import { CalendarLink } from "@/components/operations/calendar-link"

async function getContacts() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("contacts")
    .select("id, name, email, agency")
    .not("status", "eq", "churned")
    .order("name")
  return data ?? []
}

export default async function ShootsPage() {
  const contacts = await getContacts()
  const hdrs = await headers()
  const host = hdrs.get("host") ?? "localhost:3000"
  const proto = host.startsWith("localhost") ? "http" : "https"
  const feedUrl = `${proto}://${host}/api/calendar/feed.ics`

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl tracking-tight">shoots</h1>
          <p className="text-muted-foreground text-xs mt-0.5">booked → shot → processing → delivered → paid</p>
        </div>
        <CalendarLink feedUrl={feedUrl} />
      </div>
      <ShootsList contacts={contacts} />
    </div>
  )
}
