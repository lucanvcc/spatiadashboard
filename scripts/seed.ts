/**
 * Seed script — populates the database with realistic demo data.
 * Run with: npx tsx scripts/seed.ts
 *
 * Requires .env.local to be present with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(process.cwd(), ".env.local") })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function days(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

function daysDate(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split("T")[0]
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── Contacts ────────────────────────────────────────────────────────────────

const AGENCIES = [
  "RE/MAX Alliance Brossard",
  "Century 21 Vision",
  "Royal LePage Tendance",
  "Sutton Expert",
  "Proprio Direct",
  "Groupe Immobilier PMG",
  "Via Capitale Du Fleuve",
]

const AREAS = [
  ["Brossard", "Saint-Lambert"],
  ["Longueuil", "Saint-Bruno"],
  ["La Prairie", "Candiac"],
  ["Boucherville", "Saint-Julie"],
  ["Vieux-Longueuil"],
]

const STATUSES = [
  "new_lead",
  "new_lead",
  "new_lead",
  "new_lead",
  "researched",
  "researched",
  "first_email_sent",
  "first_email_sent",
  "first_email_sent",
  "followup_sent",
  "followup_sent",
  "replied",
  "replied",
  "meeting_booked",
  "trial_shoot",
  "trial_shoot",
  "paying_client",
  "paying_client",
  "paying_client",
  "churned",
] as const

const CONTACT_DATA = [
  { name: "Marie-Josée Tremblay", email: "mj.tremblay@remax.ca" },
  { name: "Patrick Bouchard", email: "pbouchard@c21vision.ca" },
  { name: "Sophie Lavoie", email: "s.lavoie@royallepage.ca" },
  { name: "Éric Gagnon", email: "eric.gagnon@suttonexpert.ca" },
  { name: "Nathalie Côté", email: "ncote@proprio.ca" },
  { name: "Jean-François Beaulieu", email: "jf.beaulieu@pmgimmobilier.ca" },
  { name: "Christine Pelletier", email: "cpelletier@viacapitale.ca" },
  { name: "Alexandre Dubois", email: "a.dubois@remax.ca" },
  { name: "Isabelle Roy", email: "iroy@c21vision.ca" },
  { name: "Marc-Antoine Leblanc", email: "ma.leblanc@royallepage.ca" },
  { name: "Geneviève Bergeron", email: "g.bergeron@suttonexpert.ca" },
  { name: "Pierre-Luc Gauthier", email: "pl.gauthier@proprio.ca" },
  { name: "Annie Morin", email: "a.morin@pmgimmobilier.ca" },
  { name: "François Ouellet", email: "f.ouellet@viacapitale.ca" },
  { name: "Stéphanie Brodeur", email: "s.brodeur@remax.ca" },
  { name: "David Lemay", email: "d.lemay@c21vision.ca" },
  { name: "Mélanie Poulin", email: "m.poulin@royallepage.ca" },
  { name: "Jonathan Savard", email: "j.savard@suttonexpert.ca" },
  { name: "Karine Beaumont", email: "k.beaumont@proprio.ca" },
  { name: "Louis Fortin", email: "l.fortin@pmgimmobilier.ca" },
  { name: "Véronique Deschamps", email: "v.deschamps@viacapitale.ca" },
  { name: "Simon Caron", email: "s.caron@remax.ca" },
  { name: "Julie Charron", email: "j.charron@c21vision.ca" },
  { name: "Mathieu Lévesque", email: "m.levesque@royallepage.ca" },
  { name: "Caroline Auger", email: "c.auger@suttonexpert.ca" },
  { name: "Benoît Mercier", email: "b.mercier@proprio.ca" },
  { name: "Audrey Blouin", email: "a.blouin@pmgimmobilier.ca" },
  { name: "Sébastien Michaud", email: "s.michaud@viacapitale.ca" },
  { name: "Pascale Turgeon", email: "p.turgeon@remax.ca" },
  { name: "Nicolas Paré", email: "n.pare@c21vision.ca" },
]

const ADDRESSES_SOUTH_SHORE = [
  "2450 Boul. Rome, Brossard, QC J4W 3G4",
  "165 Rue du Havre, Saint-Lambert, QC J4R 1H3",
  "890 Rue Jean-Paul-Vincent, Longueuil, QC J4G 1R2",
  "34 Rue des Érables, Boucherville, QC J4B 6N3",
  "1200 Boul. Taschereau, La Prairie, QC J5R 1W9",
  "78 Rue du Lac, Saint-Bruno-de-Montarville, QC J3V 4A2",
  "455 Rue Principale, Candiac, QC J5R 3P9",
]

// ─── Seed functions ──────────────────────────────────────────────────────────

async function seedContacts() {
  console.log("Seeding contacts...")
  const contacts = CONTACT_DATA.map((c, i) => ({
    name: c.name,
    email: c.email,
    phone: `514-${String(400 + i).padStart(3, "0")}-${String(1000 + i * 7).slice(-4)}`,
    agency: pick(AGENCIES),
    areas_served: pick(AREAS),
    source: pick(["realtor_scrape", "manual", "referral"] as const),
    status: STATUSES[i % STATUSES.length],
    consent_basis: "implied_b2b_public_listing",
    unsubscribed: false,
    tags: i % 5 === 0 ? ["south-shore", "high-volume"] : i % 3 === 0 ? ["follow-up"] : [],
    created_at: days(-Math.floor(Math.random() * 60)),
  }))

  const { data, error } = await supabase.from("contacts").insert(contacts).select("id, name, status")
  if (error) throw new Error(`contacts: ${error.message}`)
  console.log(`  ✓ ${data.length} contacts`)
  return data
}

async function seedShoots(contacts: { id: string; name: string; status: string }[]) {
  console.log("Seeding shoots...")
  const payingClients = contacts.filter((c) => ["paying_client", "trial_shoot"].includes(c.status))

  const shoots = [
    // 2 completed
    {
      contact_id: payingClients[0]?.id ?? contacts[0].id,
      address: ADDRESSES_SOUTH_SHORE[0],
      sq_ft: 1800,
      tier: 2,
      base_price: 200,
      rush_surcharge: 0,
      travel_surcharge: 0,
      total_price: 200,
      status: "delivered" as const,
      scheduled_at: days(-14),
      shot_at: days(-14),
      delivered_at: days(-13),
      matterport_url: "https://my.matterport.com/show/?m=demo1",
    },
    {
      contact_id: payingClients[1]?.id ?? contacts[1].id,
      address: ADDRESSES_SOUTH_SHORE[1],
      sq_ft: 2200,
      tier: 2,
      base_price: 200,
      rush_surcharge: 50,
      travel_surcharge: 0,
      total_price: 250,
      status: "paid" as const,
      scheduled_at: days(-21),
      shot_at: days(-21),
      delivered_at: days(-20),
      paid_at: days(-18),
      matterport_url: "https://my.matterport.com/show/?m=demo2",
    },
    // 2 upcoming
    {
      contact_id: payingClients[2]?.id ?? contacts[2].id,
      address: ADDRESSES_SOUTH_SHORE[2],
      sq_ft: 1400,
      tier: 1,
      base_price: 150,
      rush_surcharge: 0,
      travel_surcharge: 25,
      total_price: 175,
      status: "booked" as const,
      scheduled_at: days(3),
    },
    {
      contact_id: payingClients[0]?.id ?? contacts[0].id,
      address: ADDRESSES_SOUTH_SHORE[3],
      sq_ft: 2800,
      tier: 3,
      base_price: 275,
      rush_surcharge: 50,
      travel_surcharge: 0,
      total_price: 325,
      status: "booked" as const,
      scheduled_at: days(7),
    },
    // 1 delivered (awaiting payment)
    {
      contact_id: payingClients[1]?.id ?? contacts[1].id,
      address: ADDRESSES_SOUTH_SHORE[4],
      sq_ft: 3600,
      tier: 4,
      base_price: 350,
      rush_surcharge: 0,
      travel_surcharge: 0,
      total_price: 350,
      status: "delivered" as const,
      scheduled_at: days(-7),
      shot_at: days(-7),
      delivered_at: days(-6),
      matterport_url: "https://my.matterport.com/show/?m=demo3",
    },
  ]

  const { data, error } = await supabase.from("shoots").insert(shoots).select("id, status, contact_id, address, total_price")
  if (error) throw new Error(`shoots: ${error.message}`)
  console.log(`  ✓ ${data.length} shoots`)
  return data
}

async function seedTours(shoots: { id: string; status: string }[]) {
  console.log("Seeding tours...")
  const deliveredShoots = shoots.filter((s) => ["delivered", "paid"].includes(s.status))

  const tours = [
    {
      shoot_id: deliveredShoots[0]?.id,
      matterport_id: "SxQL3iGyvNE",
      title: "2450 Boul. Rome — Brossard",
      status: "active" as const,
      views: 47,
    },
    {
      shoot_id: deliveredShoots[1]?.id,
      matterport_id: "FaMxJDX1Mk4",
      title: "165 Rue du Havre — Saint-Lambert",
      status: "active" as const,
      views: 134,
    },
    {
      shoot_id: null,
      matterport_id: "PPYW7s9wN2J",
      title: "890 Rue Jean-Paul-Vincent — Longueuil",
      status: "active" as const,
      views: 89,
    },
    {
      shoot_id: null,
      matterport_id: "archive001",
      title: "34 Rue des Érables — Boucherville (vendu)",
      status: "archived" as const,
      views: 212,
      archived_at: days(-30),
    },
  ]

  const { data, error } = await supabase.from("tours").insert(tours).select("id")
  if (error) throw new Error(`tours: ${error.message}`)
  console.log(`  ✓ ${data.length} tours`)
  return data
}

async function seedEmails(contacts: { id: string; name: string; status: string }[]) {
  console.log("Seeding outreach emails...")

  const sentContacts = contacts.filter((c) =>
    ["first_email_sent", "followup_sent", "replied", "meeting_booked", "paying_client"].includes(c.status)
  )

  const emails = sentContacts.slice(0, 15).map((c, i) => {
    const isSent = i < 12
    const isOpened = isSent && i < 9
    const isReplied = isOpened && i < 5
    const isFollowup = i % 3 === 0

    return {
      contact_id: c.id,
      subject: isFollowup
        ? "Re: Visite virtuelle — suivi rapide"
        : "Visite 3D Matterport — même journée, résultats pro",
      body: isFollowup
        ? `Bonjour,\n\nJe me permets de faire un suivi rapide à mon dernier message. Seriez-vous disponible pour qu'on discute d'un essai gratuit?\n\nCordialement,\nLuca | Spatia\nspacespace — lucanovac@spatia.ca`
        : `Bonjour ${c.name.split(" ")[0]},\n\nJ'ai remarqué votre annonce au [adresse] — très bien présentée. Je voulais vous soumettre une idée pour vos prochaines inscriptions.\n\nSpatia offre des visites virtuelles Matterport en 3D avec livraison le jour même. Seriez-vous ouvert à un essai pour voir si ça correspond à vos besoins?\n\nCordialement,\nLuca | Spatia\nlucanovac@spatia.ca`,
      status: (isReplied ? "replied" : isOpened ? "opened" : isSent ? "sent" : "pending_review") as
        | "replied"
        | "opened"
        | "sent"
        | "pending_review",
      is_followup: isFollowup,
      sent_at: isSent ? days(-(20 - i * 1.2)) : null,
      opened_at: isOpened ? days(-(19 - i * 1.1)) : null,
      replied_at: isReplied ? days(-(18 - i)) : null,
      created_at: days(-(21 - i * 1.2)),
    }
  })

  const { data, error } = await supabase.from("outreach_emails").insert(emails).select("id")
  if (error) throw new Error(`outreach_emails: ${error.message}`)
  console.log(`  ✓ ${data.length} emails`)
  return data
}

async function seedInvoices(
  shoots: { id: string; status: string; contact_id: string; total_price: number }[]
) {
  console.log("Seeding invoices...")

  const invoiceData = shoots
    .filter((s) => ["delivered", "paid"].includes(s.status))
    .map((s) => {
      const isPaid = s.status === "paid"
      const subtotal = s.total_price
      const gst = +(subtotal * 0).toFixed(2) // under $30K threshold
      const qst = +(subtotal * 0).toFixed(2)
      return {
        shoot_id: s.id,
        contact_id: s.contact_id,
        amount: subtotal,
        discount: 0,
        subtotal,
        gst,
        qst,
        total: subtotal + gst + qst,
        status: isPaid ? ("paid" as const) : ("sent" as const),
        due_at: isPaid ? days(-10) : days(15),
        paid_at: isPaid ? days(-18) : null,
      }
    })

  const { data, error } = await supabase.from("invoices").insert(invoiceData).select("id")
  if (error) throw new Error(`invoices: ${error.message}`)
  console.log(`  ✓ ${data.length} invoices`)
  return data
}

async function seedMarketingSpend() {
  console.log("Seeding marketing spend...")

  const entries = []
  for (let i = 29; i >= 0; i--) {
    if (i % 3 === 0) {
      entries.push({
        date: daysDate(-i),
        channel: "meta" as const,
        campaign_name: "South Shore agents — prospection",
        amount_spent: +(Math.random() * 8 + 5).toFixed(2),
        impressions: Math.floor(Math.random() * 400 + 200),
        clicks: Math.floor(Math.random() * 20 + 5),
        leads_generated: Math.floor(Math.random() * 2),
      })
    }
    if (i % 7 === 0) {
      entries.push({
        date: daysDate(-i),
        channel: "instagram_promoted" as const,
        campaign_name: "Reel — avant/après visite virtuelle",
        amount_spent: +(Math.random() * 15 + 10).toFixed(2),
        impressions: Math.floor(Math.random() * 1200 + 600),
        clicks: Math.floor(Math.random() * 40 + 15),
        leads_generated: Math.floor(Math.random() * 3),
      })
    }
  }

  const { data, error } = await supabase.from("marketing_spend").insert(entries).select("id")
  if (error) throw new Error(`marketing_spend: ${error.message}`)
  console.log(`  ✓ ${data.length} spend entries`)
}

async function seedAnalytics() {
  console.log("Seeding analytics_daily...")

  const rows = []
  for (let i = 29; i >= 0; i--) {
    const emailsSent = Math.floor(Math.random() * 5)
    const emailsOpened = Math.floor(emailsSent * (Math.random() * 0.4 + 0.3))
    const replies = Math.floor(emailsOpened * (Math.random() * 0.2))
    const shootsBooked = i % 8 === 0 ? 1 : 0
    const shootsCompleted = i % 9 === 0 ? 1 : 0
    const revenue = shootsCompleted ? pick([150, 200, 250, 275, 325]) : 0

    rows.push({
      date: daysDate(-i),
      emails_sent: emailsSent,
      emails_opened: emailsOpened,
      replies,
      shoots_booked: shootsBooked,
      shoots_completed: shootsCompleted,
      revenue,
      ad_spend: i % 3 === 0 ? +(Math.random() * 15 + 5).toFixed(2) : 0,
      instagram_followers: 142 + Math.floor((30 - i) * 0.8) + Math.floor(Math.random() * 2),
      website_visits: Math.floor(Math.random() * 15 + 3),
    })
  }

  const { data, error } = await supabase.from("analytics_daily").insert(rows).select("id")
  if (error) throw new Error(`analytics_daily: ${error.message}`)
  console.log(`  ✓ ${data.length} daily analytics rows`)
}

async function seedRevenueEvents(
  shoots: { id: string; status: string; contact_id: string; total_price: number }[]
) {
  console.log("Seeding revenue events...")
  const paidShoots = shoots.filter((s) => s.status === "paid")
  const events = paidShoots.map((s) => ({
    shoot_id: s.id,
    contact_id: s.contact_id,
    source_channel: "direct_outreach",
    amount: s.total_price,
    date: daysDate(-18),
  }))

  const { data, error } = await supabase.from("revenue_events").insert(events).select("id")
  if (error) throw new Error(`revenue_events: ${error.message}`)
  console.log(`  ✓ ${data.length} revenue events`)
}

async function seedContent() {
  console.log("Seeding content calendar...")

  const PILLARS = ["the_work", "the_edge", "the_process", "the_proof", "the_culture"] as const
  const entries = []

  for (let i = 0; i < 12; i++) {
    const pillar = PILLARS[i % PILLARS.length]
    const isPosted = i < 7
    entries.push({
      platform: "instagram",
      content_type: i % 3 === 0 ? "reel" : "carousel",
      pillar,
      caption_fr: `Légende ${pillar.replace(/_/g, " ")} FR — entrée ${i + 1}`,
      caption_en: `Caption ${pillar.replace(/_/g, " ")} EN — entry ${i + 1}`,
      scheduled_at: days(isPosted ? -(28 - i * 4) : (i - 7) * 5 + 2),
      posted_at: isPosted ? days(-(28 - i * 4)) : null,
      engagement_metrics: isPosted
        ? { likes: Math.floor(Math.random() * 80 + 10), comments: Math.floor(Math.random() * 8), saves: Math.floor(Math.random() * 20) }
        : null,
    })
  }

  const { data, error } = await supabase.from("content_calendar").insert(entries).select("id")
  if (error) throw new Error(`content_calendar: ${error.message}`)
  console.log(`  ✓ ${data.length} content entries`)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Spatia seed script starting...\n")

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const contacts = await seedContacts()
  const shoots = await seedShoots(contacts)
  await seedTours(shoots)
  await seedEmails(contacts)
  await seedInvoices(shoots as any)
  await seedMarketingSpend()
  await seedAnalytics()
  await seedRevenueEvents(shoots as any)
  await seedContent()

  console.log("\n✅ Seed complete. Dashboard is now populated with demo data.")
  console.log("   Run the app and log in to see everything in action.")
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message)
  process.exit(1)
})
