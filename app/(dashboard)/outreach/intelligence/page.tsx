import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/pricing"
import { Ghost, Repeat2, Archive, TrendingDown, ExternalLink, Users } from "lucide-react"

type Ghost = {
  contact_id: string
  name: string
  agency: string | null
  opens: number
  lastOpened: string | null
  emailsSent: number
}

type RecurringClient = {
  contact_id: string
  name: string
  agency: string | null
  shootCount: number
  totalRevenue: number
  lastShootDate: string | null
}

type DeadLead = {
  contact_id: string
  name: string
  agency: string | null
  status: string
  daysSinceUpdate: number
  lastUpdate: string
}

async function getIntelligenceData() {
  const supabase = await createClient()
  const now = new Date()
  const since90 = new Date(now.getTime() - 90 * 86400000).toISOString()

  const [
    { data: allEmails },
    { data: allShoots },
    { data: allContacts },
  ] = await Promise.all([
    supabase
      .from("outreach_emails")
      .select("id, contact_id, status, opened_at, replied_at, sent_at")
      .not("status", "eq", "draft")
      .not("sent_at", "is", null),
    supabase
      .from("shoots")
      .select("id, contact_id, status, total_price, delivered_at, scheduled_at")
      .in("status", ["delivered", "paid"]),
    supabase
      .from("contacts")
      .select("id, name, email, agency, status, updated_at"),
  ])

  const contactMap = new Map((allContacts ?? []).map((c) => [c.id, c]))

  // ── Ghost detector ─────────────────────────────────────────────────────────
  const emailsByContact = new Map<string, typeof allEmails>()
  for (const email of allEmails ?? []) {
    if (!email.contact_id) continue
    if (!emailsByContact.has(email.contact_id)) emailsByContact.set(email.contact_id, [])
    emailsByContact.get(email.contact_id)!.push(email)
  }

  const ghosts: Ghost[] = []
  for (const [contactId, emails] of emailsByContact.entries()) {
    if (!emails) continue
    const hasReplied = emails.some((e) => e.status === "replied" || e.replied_at)
    if (hasReplied) continue
    const opens = emails.filter((e) => e.opened_at).length
    if (opens < 2) continue
    const contact = contactMap.get(contactId)
    if (!contact) continue
    const openDates = emails.filter((e) => e.opened_at).map((e) => e.opened_at!).sort((a, b) => b.localeCompare(a))
    ghosts.push({
      contact_id: contactId,
      name: contact.name,
      agency: contact.agency ?? null,
      opens,
      lastOpened: openDates[0] ?? null,
      emailsSent: emails.length,
    })
  }
  ghosts.sort((a, b) => b.opens - a.opens)

  // ── Recurring clients ──────────────────────────────────────────────────────
  const shootsByContact = new Map<string, typeof allShoots>()
  for (const shoot of allShoots ?? []) {
    if (!shoot.contact_id) continue
    if (!shootsByContact.has(shoot.contact_id)) shootsByContact.set(shoot.contact_id, [])
    shootsByContact.get(shoot.contact_id)!.push(shoot)
  }

  const recurringClients: RecurringClient[] = []
  for (const [contactId, shoots] of shootsByContact.entries()) {
    if (!shoots || shoots.length < 2) continue
    const contact = contactMap.get(contactId)
    if (!contact) continue
    const totalRevenue = shoots.reduce((s, sh) => s + (sh.total_price ?? 0), 0)
    const shootDates = shoots.map((s) => s.delivered_at ?? s.scheduled_at).filter(Boolean).sort((a, b) => (b ?? "").localeCompare(a ?? ""))
    recurringClients.push({
      contact_id: contactId,
      name: contact.name,
      agency: contact.agency ?? null,
      shootCount: shoots.length,
      totalRevenue,
      lastShootDate: shootDates[0] ?? null,
    })
  }
  recurringClients.sort((a, b) => b.shootCount - a.shootCount || b.totalRevenue - a.totalRevenue)

  // ── Dead leads ─────────────────────────────────────────────────────────────
  const earlyStages = ["new_lead", "researched", "first_email_sent", "followup_sent"]
  const deadLeads: DeadLead[] = []
  for (const contact of allContacts ?? []) {
    if (!earlyStages.includes(contact.status)) continue
    if (!contact.updated_at || contact.updated_at >= since90) continue
    const daysSince = Math.floor((now.getTime() - new Date(contact.updated_at).getTime()) / 86400000)
    deadLeads.push({
      contact_id: contact.id,
      name: contact.name,
      agency: contact.agency ?? null,
      status: contact.status,
      daysSinceUpdate: daysSince,
      lastUpdate: contact.updated_at,
    })
  }
  deadLeads.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)

  return { ghosts: ghosts.slice(0, 20), recurringClients: recurringClients.slice(0, 20), deadLeads: deadLeads.slice(0, 30) }
}

function daysAgo(days: number) {
  if (days === 0) return "aujourd'hui"
  if (days === 1) return "hier"
  if (days < 30) return `${days}j`
  const months = Math.floor(days / 30)
  return `${months} mois`
}

function dateShort(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-CA", { month: "short", day: "numeric" })
}

const STATUS_LABELS: Record<string, string> = {
  new_lead: "nouveau",
  researched: "recherché",
  first_email_sent: "contacté",
  followup_sent: "relancé",
}

export default async function OutreachIntelligencePage() {
  const { ghosts, recurringClients, deadLeads } = await getIntelligenceData()

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-heading text-xl tracking-tight">intelligence outreach</h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          détecteur de fantômes · clients récurrents · leads dormants
        </p>
      </div>

      {/* Ghost detector */}
      <div className="border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Ghost size={13} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-xs text-muted-foreground">détecteur de fantômes</p>
            <span className="spatia-label text-[10px] text-muted-foreground/50">
              ({ghosts.length} contact{ghosts.length !== 1 ? "s" : ""} avec 2+ ouvertures sans réponse)
            </span>
          </div>
        </div>
        {ghosts.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">Aucun fantôme détecté — tes courriels convertissent bien.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            <div className="grid grid-cols-5 gap-4 px-5 py-2 bg-muted/10">
              {["contact", "agence", "ouvertures", "envoyés", "dernière ouverture"].map((h) => (
                <p key={h} className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">{h}</p>
              ))}
            </div>
            {ghosts.map((ghost) => (
              <a
                key={ghost.contact_id}
                href={`/crm?contact=${ghost.contact_id}`}
                className="grid grid-cols-5 gap-4 px-5 py-3 hover:bg-accent/30 transition-colors group"
              >
                <div className="flex items-center gap-1.5">
                  <p className="text-sm truncate group-hover:underline underline-offset-2">{ghost.name}</p>
                  <ExternalLink size={10} strokeWidth={1.5} className="text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100" />
                </div>
                <p className="text-sm text-muted-foreground truncate">{ghost.agency ?? "—"}</p>
                <p className="font-mono text-sm text-amber-400">{ghost.opens}×</p>
                <p className="font-mono text-sm text-muted-foreground">{ghost.emailsSent}</p>
                <p className="spatia-label text-xs text-muted-foreground">{dateShort(ghost.lastOpened)}</p>
              </a>
            ))}
          </div>
        )}
        {ghosts.length > 0 && (
          <div className="px-5 py-3 border-t border-border/40">
            <p className="spatia-label text-[10px] text-muted-foreground/60">
              stratégie suggérée: angle différent, preuve sociale, ou appel direct — ils ont vu ton courriel plusieurs fois
            </p>
          </div>
        )}
      </div>

      {/* Recurring clients */}
      <div className="border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Repeat2 size={13} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-xs text-muted-foreground">clients récurrents</p>
            <span className="spatia-label text-[10px] text-muted-foreground/50">
              ({recurringClients.length} client{recurringClients.length !== 1 ? "s" : ""} avec 2+ shoots)
            </span>
          </div>
        </div>
        {recurringClients.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">Aucun client récurrent encore — continue à livrer de bons tours.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            <div className="grid grid-cols-5 gap-4 px-5 py-2 bg-muted/10">
              {["contact", "agence", "shoots", "revenu total", "dernier shoot"].map((h) => (
                <p key={h} className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">{h}</p>
              ))}
            </div>
            {recurringClients.map((client) => (
              <a
                key={client.contact_id}
                href={`/crm?contact=${client.contact_id}`}
                className="grid grid-cols-5 gap-4 px-5 py-3 hover:bg-accent/30 transition-colors group"
              >
                <div className="flex items-center gap-1.5">
                  <p className="text-sm truncate group-hover:underline underline-offset-2">{client.name}</p>
                  <ExternalLink size={10} strokeWidth={1.5} className="text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100" />
                </div>
                <p className="text-sm text-muted-foreground truncate">{client.agency ?? "—"}</p>
                <p className="font-mono text-sm text-emerald-400">{client.shootCount}</p>
                <p className="font-mono text-sm">{formatCurrency(client.totalRevenue)}</p>
                <p className="spatia-label text-xs text-muted-foreground">{dateShort(client.lastShootDate)}</p>
              </a>
            ))}
          </div>
        )}
        {recurringClients.length > 0 && (
          <div className="px-5 py-3 border-t border-border/40">
            <p className="spatia-label text-[10px] text-muted-foreground/60">
              opportunité: propose un forfait récurrent ou une entente prioritaire à ces clients fidèles
            </p>
          </div>
        )}
      </div>

      {/* Dead leads */}
      <div className="border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Archive size={13} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-xs text-muted-foreground">leads dormants — 90+ jours</p>
            <span className="spatia-label text-[10px] text-muted-foreground/50">
              ({deadLeads.length} contact{deadLeads.length !== 1 ? "s" : ""} à recycler)
            </span>
          </div>
        </div>
        {deadLeads.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">Aucun lead dormant — bonne cadence d&apos;outreach.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            <div className="grid grid-cols-5 gap-4 px-5 py-2 bg-muted/10">
              {["contact", "agence", "statut", "dormant depuis", "dernière activité"].map((h) => (
                <p key={h} className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">{h}</p>
              ))}
            </div>
            {deadLeads.map((lead) => (
              <a
                key={lead.contact_id}
                href={`/crm?contact=${lead.contact_id}`}
                className="grid grid-cols-5 gap-4 px-5 py-3 hover:bg-accent/30 transition-colors group"
              >
                <div className="flex items-center gap-1.5">
                  <p className="text-sm truncate group-hover:underline underline-offset-2">{lead.name}</p>
                  <ExternalLink size={10} strokeWidth={1.5} className="text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100" />
                </div>
                <p className="text-sm text-muted-foreground truncate">{lead.agency ?? "—"}</p>
                <p className="spatia-label text-xs text-muted-foreground">{STATUS_LABELS[lead.status] ?? lead.status}</p>
                <p className={`font-mono text-sm ${lead.daysSinceUpdate > 180 ? "text-red-400" : "text-amber-400"}`}>
                  {daysAgo(lead.daysSinceUpdate)}
                </p>
                <p className="spatia-label text-xs text-muted-foreground">{dateShort(lead.lastUpdate)}</p>
              </a>
            ))}
          </div>
        )}
        {deadLeads.length > 0 && (
          <div className="px-5 py-3 border-t border-border/40">
            <p className="spatia-label text-[10px] text-muted-foreground/60">
              stratégie: nouveau listing = angle de re-engagement naturel — vérifie si le marché a changé dans leurs zones
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
