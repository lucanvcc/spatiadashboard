// ─── Severity + Type enums ────────────────────────────────────────────────────

export type ActionItemSeverity = 'critical' | 'warning' | 'info' | 'success'

export type ActionItemType =
  | 'followup_due'
  | 'invoice_overdue'
  | 'shoot_today'
  | 'shoot_tomorrow'
  | 'slot_warning'
  | 'tax_threshold'
  | 'listing_sold'
  | 'campaign_waste'
  | 'campaign_scale'
  | 'import_failed'
  | 'cron_failure'
  | 'custom'

export type RelatedEntityType =
  | 'contact'
  | 'invoice'
  | 'shoot'
  | 'tour'
  | 'listing'
  | 'campaign'
  | 'cron_job'

// ─── Data payloads per type ───────────────────────────────────────────────────

export interface FollowupDueData {
  contact_name: string
  contact_email: string
  agency?: string | null
  days_since_first_email: number
  stage: string
}

export interface InvoiceOverdueData {
  contact_name?: string | null
  amount: number
  due_date: string
  days_overdue: number
}

export interface ShootData {
  contact_name?: string | null
  address: string
  sq_ft?: number | null
  tier?: number | null
  price?: number | null
  scheduled_time?: string | null
}

export interface SlotWarningData {
  active_count: number
  limit: number
  percentage: number
}

export interface TaxThresholdData {
  ytd_revenue: number
  threshold: number
  percentage: number
}

export interface ListingSoldData {
  address?: string | null
  mls_number?: string | null
  tour_id?: string | null
  agent_name?: string | null
}

export interface CampaignData {
  campaign_name: string
  spend_7d: number
  results_7d: number
  cost_per_result?: number | null
  booked_shoots?: number | null
  roas?: number | null
}

export interface ImportFailedData {
  filename?: string | null
  error?: string | null
}

export interface CronFailureData {
  job_name: string
  error: string
}

// ─── Discriminated union map ──────────────────────────────────────────────────

export type ActionItemDataMap = {
  followup_due: FollowupDueData
  invoice_overdue: InvoiceOverdueData
  shoot_today: ShootData
  shoot_tomorrow: ShootData
  slot_warning: SlotWarningData
  tax_threshold: TaxThresholdData
  listing_sold: ListingSoldData
  campaign_waste: CampaignData
  campaign_scale: CampaignData
  import_failed: ImportFailedData
  cron_failure: CronFailureData
  custom: Record<string, unknown>
}

// ─── Core ActionItem interface ────────────────────────────────────────────────

export interface ActionItem<T extends ActionItemType = ActionItemType> {
  id: string
  type: T
  severity: ActionItemSeverity
  title: string
  description: string | null
  related_entity_type: RelatedEntityType | null
  related_entity_id: string | null
  related_url: string | null
  source: string
  is_resolved: boolean
  resolved_at: string | null
  resolved_by: 'user' | 'cron' | 'system' | null
  resolution_note: string | null
  is_dismissed: boolean
  dismissed_at: string | null
  expires_at: string | null
  data: T extends keyof ActionItemDataMap ? ActionItemDataMap[T] | null : Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// Generic form used when we don't know the type statically
export type AnyActionItem = {
  id: string
  type: ActionItemType
  severity: ActionItemSeverity
  title: string
  description: string | null
  related_entity_type: RelatedEntityType | null
  related_entity_id: string | null
  related_url: string | null
  source: string
  is_resolved: boolean
  resolved_at: string | null
  resolved_by: 'user' | 'cron' | 'system' | null
  resolution_note: string | null
  is_dismissed: boolean
  dismissed_at: string | null
  expires_at: string | null
  data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ─── CommandLog ───────────────────────────────────────────────────────────────

export interface CommandLog {
  id: string
  command: string
  params: Record<string, unknown> | null
  executed_at: string
}

// ─── Upsert params ────────────────────────────────────────────────────────────

export interface UpsertActionItemParams {
  type: ActionItemType
  severity: ActionItemSeverity
  title: string
  description?: string | null
  related_entity_type?: RelatedEntityType | null
  related_entity_id?: string | null
  related_url?: string | null
  source: string
  data?: Record<string, unknown> | null
  expires_at?: string | null
}
