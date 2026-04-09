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
  wave_customer_id: string | null
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
  wave_invoice_url: string | null
  amount: number
  discount: number
  subtotal: number
  gst: number
  qst: number
  total: number
  status: InvoiceStatus
  source_system: string
  notes: string | null
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
  last_checked_at: string | null
  sold_detected_at: string | null
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
  invoice_id: string | null
  wave_import_batch_id: string | null
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
  shoots_completed: number
  revenue: number
  ad_spend: number
  instagram_followers: number | null
  website_visits: number | null
  created_at: string
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export interface Note {
  id: string
  contact_id: string | null
  content: string
  category: string | null
  created_at: string
}

// ─── Money Engine ───────────────────────────────────────────────────────────

export type ParsedStatus = "pending" | "matched" | "partial" | "failed" | "skipped"
export type ImportSourceType = "wave_invoices" | "wave_expenses"
export type ImportBatchStatus = "processing" | "completed" | "failed"
export type ExpenseCategory =
  | "equipment"
  | "software"
  | "travel"
  | "marketing"
  | "matterport_subscription"
  | "other"

export interface ImportBatch {
  id: string
  filename: string
  uploaded_at: string
  total_rows: number
  matched_rows: number
  partial_rows: number
  failed_rows: number
  skipped_rows: number
  status: ImportBatchStatus
  source_type: ImportSourceType
}

export interface WaveRawImport {
  id: string
  imported_at: string
  filename: string
  row_index: number
  row_raw: Record<string, string>
  parsed_status: ParsedStatus
  matched_invoice_id: string | null
  matched_contact_id: string | null
  error_message: string | null
  import_batch_id: string
}

export interface Expense {
  id: string
  date: string
  category: ExpenseCategory
  description: string
  amount: number
  gst_paid: number
  qst_paid: number
  vendor: string | null
  receipt_url: string | null
  source_system: string
  wave_transaction_id: string | null
  import_batch_id: string | null
  created_at: string
}

export interface TaxSummarySnapshot {
  id: string
  period_start: string
  period_end: string
  total_revenue: number
  gst_collected: number
  qst_collected: number
  gst_paid: number
  qst_paid: number
  net_gst_owing: number
  net_qst_owing: number
  cumulative_ytd_revenue: number
  threshold_30k_pct: number
  snapshot_type: "weekly" | "monthly" | "quarterly" | "manual"
  created_at: string
}

export interface ImportSummary {
  batchId: string
  totalRows: number
  matched: number
  partial: number
  failed: number
  skipped: number
}

// ─── Email Templates ────────────────────────────────────────────────────────

export type TemplateLanguage = "fr" | "en" | "bilingual"

export interface EmailTemplate {
  id: string
  name: string
  subject_template: string
  body_template: string
  language: TemplateLanguage
  variables_schema: string[] | null
  created_at: string
  updated_at: string
}

// ─── Alerts ─────────────────────────────────────────────────────────────────

export type AlertSeverity = "info" | "warning" | "critical"

export interface Alert {
  id: string
  type: string
  message: string
  severity: AlertSeverity
  dismissed: boolean
  created_at: string
}

// ─── Calendar Events ─────────────────────────────────────────────────────────

export type CalendarEventType = "shoot" | "call" | "post" | "meeting" | "task" | "other"

export interface CalendarEvent {
  id: string
  title: string
  event_type: CalendarEventType
  starts_at: string
  ends_at: string | null
  all_day: boolean
  description: string | null
  location: string | null
  contact_id: string | null
  shoot_id: string | null
  content_id: string | null
  completed: boolean
  created_at: string
}

// ─── Scrape Logs ─────────────────────────────────────────────────────────────

export interface ScrapeLog {
  id: string
  query: string
  results_count: number
  imported_count: number
  ran_at: string
  meta: Record<string, unknown> | null
}

// ─── Cron Logs ───────────────────────────────────────────────────────────────

export type CronJobStatus = "success" | "error"

export interface CronLog {
  id: string
  job_name: string
  status: CronJobStatus
  result_summary: string | null
  ran_at: string
  duration_ms: number | null
  action_items_created: number
}

// ─── Action Items ────────────────────────────────────────────────────────────

export type ActionItemSeverity = "critical" | "warning" | "info" | "success"
export type ActionItemSource = "manual" | "cron" | "system"

export interface ActionItem {
  id: string
  type: string
  severity: ActionItemSeverity
  title: string
  description: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  related_url: string | null
  source: ActionItemSource
  is_resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  resolution_note: string | null
  is_dismissed: boolean
  dismissed_at: string | null
  expires_at: string | null
  data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ─── Command Log ─────────────────────────────────────────────────────────────

export interface CommandLog {
  id: string
  command: string
  params: Record<string, unknown> | null
  executed_at: string
}

// ─── Phase 2: Ad Accounts ────────────────────────────────────────────────────

export type AdPlatform = "meta" | "google" | "instagram_promoted" | "other"

export interface AdAccount {
  id: string
  platform: AdPlatform
  account_id: string
  account_name: string
  currency: string
  is_active: boolean
  created_at: string
}

// ─── Phase 2: Ad Campaigns ───────────────────────────────────────────────────

export type AdCampaignStatus = "active" | "paused" | "completed" | "draft"

export interface AdCampaign {
  id: string
  ad_account_id: string
  external_campaign_id: string | null
  name: string
  status: AdCampaignStatus
  objective: string | null
  budget_daily: number | null
  budget_total: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
}

// ─── Phase 2: Ad Sets ────────────────────────────────────────────────────────

export interface AdSet {
  id: string
  ad_campaign_id: string
  external_adset_id: string | null
  name: string
  status: AdCampaignStatus
  targeting_summary: string | null
  budget_daily: number | null
  created_at: string
}

// ─── Phase 2: Ad Creatives ───────────────────────────────────────────────────

export type AdCreativeType = "image" | "video" | "carousel" | "story" | "other"

export interface AdCreative {
  id: string
  ad_set_id: string | null
  external_creative_id: string | null
  name: string
  creative_type: AdCreativeType
  headline: string | null
  body: string | null
  cta_text: string | null
  media_url: string | null
  created_at: string
}

// ─── Phase 2: Ad Metrics ─────────────────────────────────────────────────────

export interface AdMetric {
  id: string
  ad_campaign_id: string
  ad_set_id: string | null
  date: string
  impressions: number
  clicks: number
  spend: number
  leads: number
  conversions: number
  reach: number | null
  frequency: number | null
  cpm: number | null
  cpc: number | null
  cpl: number | null
  roas: number | null
  created_at: string
}

// ─── Phase 2: Social Post Metrics ────────────────────────────────────────────

export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "linkedin" | "facebook" | "other"

export interface SocialPostMetric {
  id: string
  content_calendar_id: string | null
  platform: SocialPlatform
  post_id: string | null
  date: string
  likes: number
  comments: number
  saves: number
  shares: number
  reach: number | null
  impressions: number | null
  profile_visits: number | null
  created_at: string
}

// ─── Phase 2: Campaign Attributions ──────────────────────────────────────────

export type AttributionChannel =
  | "meta"
  | "google"
  | "instagram_promoted"
  | "organic"
  | "referral"
  | "cold_email"
  | "formspree"
  | "other"

export interface CampaignAttribution {
  id: string
  contact_id: string
  ad_campaign_id: string | null
  shoot_id: string | null
  revenue_event_id: string | null
  attribution_channel: AttributionChannel
  attribution_date: string
  revenue_attributed: number | null
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
