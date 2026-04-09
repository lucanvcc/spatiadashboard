import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/pricing"
import { Camera, MapPin, Phone, Mail, Clock, CheckSquare, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { PrintButton } from "@/components/operations/print-button"

async function getUpcomingShoots() {
  const supabase = await createClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10)
  const dayAfter = new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10)

  const { data } = await supabase
    .from("shoots")
    .select(`
      id, address, sq_ft, tier, base_price, rush_surcharge, travel_surcharge, total_price,
      status, scheduled_at, matterport_url,
      contacts(id, name, email, phone, agency, language, areas_served, notes)
    `)
    .in("status", ["booked", "confirmed"])
    .gte("scheduled_at", `${today}T00:00:00`)
    .lte("scheduled_at", `${dayAfter}T23:59:59`)
    .order("scheduled_at", { ascending: true })

  return data ?? []
}

const EQUIPMENT_CHECKLIST = [
  "Matterport Pro3 camera",
  "Ricoh Theta Z1 (backup)",
  "Trépied stable",
  "Câble USB-C + batterie de secours",
  "iPad ou téléphone (app Matterport)",
  "Chargeurs (appareil + iPad)",
  "Carte mémoire formatée",
  "Cartes de visite Spatia",
  "Pantoufles/couvre-chaussures",
]

const SHOOT_CHECKLIST = [
  "Confirmer RDV avec le client (SMS)",
  "Vérifier l'adresse sur Google Maps",
  "Estimer temps de trajet (+15 min tampon)",
  "Ouvrir l'app Matterport — nouveau scan",
  "Nommer le projet: [adresse] — [date]",
  "Faire le tour de la propriété avant de scanner",
  "Démarrer depuis l'entrée principale",
  "Couvrir toutes les pièces (salle de bain incluse)",
  "Vérifier la carte de scan en temps réel",
  "Prendre des photos supplémentaires si besoin",
  "Livrer le jour même (même si soir)",
]

function tierLabel(tier: number | null) {
  if (!tier) return "—"
  return { 1: "Tier 1 ≤1500sqft", 2: "Tier 2 1500–2500sqft", 3: "Tier 3 2500–3500sqft", 4: "Tier 4 3500+sqft" }[tier] ?? `Tier ${tier}`
}

function shootTimeLabel(iso: string | null) {
  if (!iso) return "Heure non définie"
  return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })
}

function shootDateLabel(iso: string | null) {
  if (!iso) return "Date non définie"
  return new Date(iso).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })
}

function isToday(iso: string | null) {
  if (!iso) return false
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10)
}

function isTomorrow(iso: string | null) {
  if (!iso) return false
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  return iso.slice(0, 10) === tomorrow
}

export default async function ShootPrepPage() {
  const shoots = await getUpcomingShoots()

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/operations/shoots"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
          </Link>
          <div>
            <h1 className="font-heading text-xl tracking-tight">feuille de préparation</h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              {new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      {/* Equipment checklist */}
      <div className="border border-border bg-card p-5 space-y-3 print:break-inside-avoid">
        <div className="flex items-center gap-2">
          <Camera size={13} strokeWidth={1.5} className="text-muted-foreground" />
          <p className="spatia-label text-xs text-muted-foreground">équipement</p>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {EQUIPMENT_CHECKLIST.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <CheckSquare size={12} strokeWidth={1.5} className="text-muted-foreground/40 shrink-0" />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* No shoots */}
      {shoots.length === 0 && (
        <div className="border border-border bg-card p-10 text-center space-y-2">
          <Camera size={32} strokeWidth={1} className="text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">Aucun shoot prévu aujourd&apos;hui ou demain.</p>
          <Link href="/operations/shoots" className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors">
            voir tous les shoots →
          </Link>
        </div>
      )}

      {/* Shoots */}
      {shoots.map((shoot) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contact = shoot.contacts as any
        const dayTag = isToday(shoot.scheduled_at) ? "AUJOURD'HUI" : isTomorrow(shoot.scheduled_at) ? "DEMAIN" : "BIENTÔT"
        const dayColor = isToday(shoot.scheduled_at) ? "text-red-400 border-red-400/30" : "text-amber-400 border-amber-400/30"
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shoot.address)}`

        return (
          <div key={shoot.id} className="border border-border bg-card p-5 space-y-5 print:break-inside-avoid">
            {/* Shoot header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`spatia-label text-[10px] border px-1.5 py-0.5 ${dayColor}`}>{dayTag}</span>
                  {shoot.status === "confirmed" && (
                    <span className="spatia-label text-[10px] border border-emerald-400/30 text-emerald-400 px-1.5 py-0.5">CONFIRMÉ</span>
                  )}
                </div>
                <h2 className="font-heading text-lg tracking-tight">{shoot.address}</h2>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock size={11} strokeWidth={1.5} />
                  <span className="spatia-label text-xs">
                    {shootDateLabel(shoot.scheduled_at)} à {shootTimeLabel(shoot.scheduled_at)}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-2xl">{formatCurrency(shoot.total_price ?? 0)}</p>
                <p className="spatia-label text-[10px] text-muted-foreground mt-0.5">{tierLabel(shoot.tier)}</p>
                {shoot.sq_ft && <p className="spatia-label text-[10px] text-muted-foreground">{shoot.sq_ft} pi²</p>}
              </div>
            </div>

            {/* Property + Client grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Property info */}
              <div className="space-y-2">
                <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">propriété</p>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 group"
                >
                  <MapPin size={12} strokeWidth={1.5} className="text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-sm group-hover:underline underline-offset-2">{shoot.address}</span>
                </a>
                {shoot.sq_ft && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-3" />
                    {shoot.sq_ft} pi² · {tierLabel(shoot.tier)}
                  </div>
                )}
                {shoot.rush_surcharge > 0 && (
                  <div className="spatia-label text-[10px] text-amber-400">⚡ Rush +{formatCurrency(shoot.rush_surcharge)}</div>
                )}
                {shoot.travel_surcharge > 0 && (
                  <div className="spatia-label text-[10px] text-muted-foreground">🚗 Déplacement +{formatCurrency(shoot.travel_surcharge)}</div>
                )}
              </div>

              {/* Client info */}
              {contact && (
                <div className="space-y-2">
                  <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">client</p>
                  <p className="text-sm font-medium">{contact.name}</p>
                  {contact.agency && (
                    <p className="text-xs text-muted-foreground">{contact.agency}</p>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm hover:text-foreground transition-colors">
                      <Phone size={11} strokeWidth={1.5} className="text-muted-foreground" />
                      {contact.phone}
                    </a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm hover:text-foreground transition-colors">
                      <Mail size={11} strokeWidth={1.5} className="text-muted-foreground" />
                      {contact.email}
                    </a>
                  )}
                  {contact.language && (
                    <p className="spatia-label text-[10px] text-muted-foreground">
                      Langue: {contact.language === "fr" ? "Français" : "English"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Shoot-day checklist */}
            <div className="space-y-2">
              <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">checklist jour-J</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {SHOOT_CHECKLIST.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckSquare size={12} strokeWidth={1.5} className="text-muted-foreground/40 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {contact?.notes && (
              <div className="border-t border-border/40 pt-3 space-y-1">
                <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">notes client</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{contact.notes}</p>
              </div>
            )}

            {/* Matterport URL if already linked */}
            {shoot.matterport_url && (
              <div className="border-t border-border/40 pt-3">
                <p className="spatia-label text-[10px] text-muted-foreground mb-1">tour existant</p>
                <a
                  href={shoot.matterport_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {shoot.matterport_url}
                </a>
              </div>
            )}
          </div>
        )
      })}

      {/* Post-shoot autopilot reminder */}
      {shoots.length > 0 && (
        <div className="border border-emerald-400/20 bg-emerald-400/5 p-4 space-y-2 print:break-inside-avoid">
          <p className="spatia-label text-[10px] text-emerald-400/70 uppercase tracking-widest">après le shoot</p>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {[
              "Traitement Matterport (2–4h après upload)",
              "Vérification qualité du scan",
              "Partager le lien au client",
              "Créer la facture depuis /operations/shoots",
              "Envoyer la facture par courriel",
              "Mettre à jour le statut → livré",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckSquare size={12} strokeWidth={1.5} className="text-emerald-400/40 shrink-0" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
