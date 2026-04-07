import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface SearchResult {
  type: string
  id: string
  title: string
  subtitle: string
  url: string
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const type = req.nextUrl.searchParams.get("type") ?? "all"

  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const term = `%${q}%`
  const results: SearchResult[] = []

  const fetches: Promise<void>[] = []

  if (type === "all" || type === "contacts") {
    fetches.push(
      (async () => {
        const { data } = await supabase
          .from("contacts")
          .select("id, name, email, agency, status")
          .or(`name.ilike.${term},email.ilike.${term},agency.ilike.${term}`)
          .limit(5)
        for (const c of data ?? []) {
          results.push({
            type: "contact",
            id: c.id,
            title: c.name,
            subtitle: [c.agency, c.email, c.status.replace(/_/g, " ")]
              .filter(Boolean)
              .join(" · "),
            url: `/crm?contact=${c.id}`,
          })
        }
      })()
    )
  }

  if (type === "all" || type === "shoots") {
    fetches.push(
      (async () => {
        const { data } = await supabase
          .from("shoots")
          .select("id, address, status, contacts(name)")
          .ilike("address", term)
          .limit(5)
        for (const s of data ?? []) {
          const contactName =
            s.contacts && !Array.isArray(s.contacts)
              ? (s.contacts as { name: string }).name
              : null
          results.push({
            type: "shoot",
            id: s.id,
            title: s.address,
            subtitle: [contactName, s.status.replace(/_/g, " ")]
              .filter(Boolean)
              .join(" · "),
            url: `/operations/shoots`,
          })
        }
      })()
    )
  }

  if (type === "all" || type === "invoices") {
    fetches.push(
      (async () => {
        const { data } = await supabase
          .from("invoices")
          .select("id, wave_invoice_id, total, status, contacts(name)")
          .ilike("wave_invoice_id", term)
          .limit(5)
        for (const i of data ?? []) {
          const contactName =
            i.contacts && !Array.isArray(i.contacts)
              ? (i.contacts as { name: string }).name
              : null
          results.push({
            type: "invoice",
            id: i.id,
            title: `Facture #${i.wave_invoice_id ?? i.id.slice(0, 8)}`,
            subtitle: [contactName, `$${i.total}`, i.status]
              .filter(Boolean)
              .join(" · "),
            url: `/money/invoices/${i.id}`,
          })
        }
      })()
    )
  }

  if (type === "all" || type === "campaigns") {
    fetches.push(
      (async () => {
        const { data } = await supabase
          .from("ad_campaigns")
          .select("id, name, status")
          .ilike("name", term)
          .limit(5)
        for (const c of data ?? []) {
          results.push({
            type: "campaign",
            id: c.id,
            title: c.name,
            subtitle: c.status ?? "",
            url: `/marketing`,
          })
        }
      })()
    )
  }

  // Search contacts by name and surface their invoices
  if (type === "all" || type === "invoices") {
    fetches.push(
      (async () => {
        const { data: contactsData } = await supabase
          .from("contacts")
          .select("id, name")
          .ilike("name", term)
          .limit(3)
        for (const c of contactsData ?? []) {
          const { data: invoiceData } = await supabase
            .from("invoices")
            .select("id, wave_invoice_id, total, status")
            .eq("contact_id", c.id)
            .limit(2)
          for (const i of invoiceData ?? []) {
            const alreadyAdded = results.find((r) => r.id === i.id)
            if (!alreadyAdded) {
              results.push({
                type: "invoice",
                id: i.id,
                title: `Facture #${i.wave_invoice_id ?? i.id.slice(0, 8)}`,
                subtitle: [c.name, `$${i.total}`, i.status].filter(Boolean).join(" · "),
                url: `/money/invoices/${i.id}`,
              })
            }
          }
        }
      })()
    )
  }

  await Promise.all(fetches)

  // Deduplicate by id+type, limit to 15 total
  const seen = new Set<string>()
  const deduped = results.filter((r) => {
    const key = `${r.type}:${r.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json({ results: deduped.slice(0, 15) })
}
