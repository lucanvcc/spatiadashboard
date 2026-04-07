// ─── Contacts / CRM ────────────────────────────────────────────────────────

export type ContactStatus =
  | "new_lead"
  | "researched"
  | "first_email_sent"
  | "followup_sent"
  | "replied"
  | "meeting_booked"
  | "trial_shoot"
  | "paying_client"
  | "churned"

export type ContactSource =
  | "realtor_scrape"
  | "instagram_dm"
  | "referral"
  | "manual"
  | "formspree"
  | "cold_email"

export interface Contact {
  id: string
  name: string
  email: string
  phone: string | null
  agency: string | null
  areas_served: string[] | null
  source: ContactSource
  status: ContactStatus
  notes: string | null
  tags: string[]
  consent_basis: string
  unsubscribed: boolean
  created_at: string
  updated_at: string
}

// ─── Outreach ───────────────────────────────────────────────────────────────

export type EmailStatus = "draft" | "pending_review" | "sent" | "opened" | "replied" | "bounced"

export interface OutreachEmail {
  id: string
  contact_id: string
  campaign_id: string | null
  subject: string
  body: string
  status: EmailStatus
  is_followup: boolean
  sent_at: string | null
  opened_at: string | null
  replied_at: string | null
  created_at: string
}

export type CampaignStatus = "draft" | "active" | "paused" | "completed"
export type CampaignType = "cold_outreach" | "followup" | "reengagement"

export interface Campaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  template: string | null
  target_criteria: Record<string, unknown> | null
  stats: {
    sent: number
    opened: number
    replied: number
    booked: number
  }
  created_at: string
}

// ─── Shoots ─────────────────────────────────────────────────────────────────

export type ShootStatus = "booked" | "shot" | "processing" | "delivered" | "paid"
export type PricingTier = 1 | 2 | 3 | 4

export interface Shoot {
  id: string
  contact_id: string
  address: string
  sq_ft: number
  tier: PricingTier
  base_price: number
  rush_surcharge: number
  travel_surcharge: number
  total_price: number
  status: ShootStatus
  scheduled_at: string | null
  shot_at: string | null
  delivered_at: string | null
  paid_at: string | null
  matterport_url: string | null
  notes: string | null
  created_at: string
}

// ─── Invoices ───────────────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled"

export interface Invoice {
  id: string
  shoot_id: string | null
  contact_id: string
  wave_invoice_id: string | null
  amount: number
  discount: number
  subtotal: number
  gst: number
  qst: number
  total: number
  status: InvoiceStatus
  due_at: string | null
  paid_at: string | null
  created_at: string
}

// ─── Tours ──────────────────────────────────────────────────────────────────

export type TourStatus = "active" | "archived"

export interface Tour {
  id: string
  shoot_id: string | null
  matterport_id: string
  title: string | null
  status: TourStatus
  views: number
  listing_id: string | null
  archived_at: string | null
  created_at: string
}

// ─── Listings ───────────────────────────────────────────────────────────────

export type ListingStatus = "active" | "sold" | "expired" | "unknown"

export interface Listing {
  id: string
  address: string
  mls_number: string | null
  agent_name: string | null
  contact_id: string | null
  status: ListingStatus
  price: number | null
  realtor_url: string | null
  last_checked: string | null
  created_at: string
}

// ─── Marketing ──────────────────────────────────────────────────────────────

export type AdChannel = "meta" | "google" | "instagram_promoted" | "other"

export interface MarketingSpend {
  id: string
  date: string
  channel: AdChannel
  campaign_name: string | null
  amount_spent: number
  impressions: number | null
  clicks: number | null
  leads_generated: number | null
  created_at: string
}

export type RevenueSource =
  | "cold_email"
  | "instagram_dm"
  | "referral"
  | "meta_ad"
  | "google_ad"
  | "organic"
  | "formspree"

export interface RevenueEvent {
  id: string
  source: RevenueSource
  contact_id: string | null
  shoot_id: string | null
  amount: number
  date: string
  notes: string | null
  created_at: string
}

// ─── Content Calendar ───────────────────────────────────────────────────────

export type ContentPillar = "the_work" | "the_edge" | "the_process" | "the_proof" | "the_culture"
export type ContentStatus = "draft" | "scheduled" | "posted" | "analyzed"
export type ContentPlatform = "instagram" | "other"

export interface ContentCalendarEntry {
  id: string
  platform: ContentPlatform
  content_type: string
  pillar: ContentPillar
  caption_fr: string | null
  caption_en: string | null
  media_url: string | null
  scheduled_at: string | null
  posted_at: string | null
  status: ContentStatus
  engagement_metrics: {
    likes?: number
    comments?: number
    saves?: number
    reach?: number
  } | null
  created_at: string
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export interface AnalyticsDaily {
  id: string
  date: string
  emails_sent: number
  emails_opened: number
  replies: number
  shoots_booked: number
  revenue: number
  ad_spend: number
  instagram_followers: number | null
  website_visits: number | null
  created_at: string
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export interface Note {
  id: string
  content: string
  category: string | null
  created_at: string
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardStats {
  revenue_mtd: number
  revenue_last_month: number
  shoots_mtd: number
  shoots_last_month: number
  pipeline_total: number
  pipeline_conversion_rate: number
  matterport_slots_used: number
  matterport_slots_total: number
  emails_awaiting_review: number
  overdue_invoices: number
  tours_on_sold_listings: number
  content_gaps: string[]
}
