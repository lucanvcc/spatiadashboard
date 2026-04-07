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

export type EmailStatus =
  | "draft"
  | "pending_review"
  | "sent"
  | "rejected"
  | "opened"
  | "replied"
  | "bounced"

export type CampaignStatus = "draft" | "active" | "paused" | "completed"

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
  tags: string[] | null
  consent_basis: string
  unsubscribed: boolean
  created_at: string
  updated_at: string
}

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
  contacts?: Pick<Contact, "id" | "name" | "email" | "agency">
  campaigns?: Pick<Campaign, "id" | "name">
}

export interface Campaign {
  id: string
  name: string
  type: "cold_outreach" | "followup" | "reengagement"
  status: CampaignStatus
  template: string | null
  target_criteria: Record<string, string | null> | null
  stats: CampaignStats | null
  created_at: string
}

export interface CampaignStats {
  sent: number
  opened: number
  replied: number
  booked: number
}

export interface Note {
  id: string
  content: string
  category: string | null
  contact_id: string | null
  created_at: string
}

export const PIPELINE_STAGES: { key: ContactStatus; label: string }[] = [
  { key: "new_lead", label: "New Lead" },
  { key: "researched", label: "Researched" },
  { key: "first_email_sent", label: "First Email" },
  { key: "followup_sent", label: "Follow-up" },
  { key: "replied", label: "Replied" },
  { key: "meeting_booked", label: "Meeting" },
  { key: "trial_shoot", label: "Trial" },
  { key: "paying_client", label: "Client" },
  { key: "churned", label: "Churned" },
]
