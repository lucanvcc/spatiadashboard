-- ============================================================
-- Spatia Growth Command Center — Initial Schema
-- Run this in Supabase SQL editor or via supabase CLI
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for fuzzy search on contacts

-- ─── CONTACTS ────────────────────────────────────────────────────────────────

create type contact_status as enum (
  'new_lead',
  'researched',
  'first_email_sent',
  'followup_sent',
  'replied',
  'meeting_booked',
  'trial_shoot',
  'paying_client',
  'churned'
);

create type contact_source as enum (
  'realtor_scrape',
  'instagram_dm',
  'referral',
  'manual',
  'formspree',
  'cold_email'
);

create table contacts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null,
  phone text,
  agency text,
  areas_served text[],
  source contact_source not null default 'manual',
  status contact_status not null default 'new_lead',
  notes text,
  tags text[] default '{}',
  consent_basis text not null default 'implied_b2b_public_listing',
  unsubscribed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_email_unique unique (email)
);

create index idx_contacts_status on contacts(status);
create index idx_contacts_email on contacts(email);
create index idx_contacts_name_trgm on contacts using gin(name gin_trgm_ops);
create index idx_contacts_agency on contacts(agency);

-- ─── CAMPAIGNS ───────────────────────────────────────────────────────────────

create type campaign_status as enum ('draft', 'active', 'paused', 'completed');
create type campaign_type as enum ('cold_outreach', 'followup', 'reengagement');

create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type campaign_type not null default 'cold_outreach',
  status campaign_status not null default 'draft',
  template text,
  target_criteria jsonb,
  stats jsonb not null default '{"sent": 0, "opened": 0, "replied": 0, "booked": 0}',
  created_at timestamptz not null default now()
);

-- ─── OUTREACH EMAILS ─────────────────────────────────────────────────────────

create type email_status as enum ('draft', 'pending_review', 'sent', 'opened', 'replied', 'bounced');

create table outreach_emails (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references contacts(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  subject text not null,
  body text not null,
  status email_status not null default 'draft',
  is_followup boolean not null default false,
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_outreach_emails_contact_id on outreach_emails(contact_id);
create index idx_outreach_emails_campaign_id on outreach_emails(campaign_id);
create index idx_outreach_emails_status on outreach_emails(status);

-- ─── SHOOTS ──────────────────────────────────────────────────────────────────

create type shoot_status as enum ('booked', 'shot', 'processing', 'delivered', 'paid');

create table shoots (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references contacts(id) on delete restrict,
  address text not null,
  sq_ft integer not null,
  tier smallint not null check (tier between 1 and 4),
  base_price numeric(10, 2) not null,
  rush_surcharge numeric(10, 2) not null default 0,
  travel_surcharge numeric(10, 2) not null default 0,
  total_price numeric(10, 2) not null,
  status shoot_status not null default 'booked',
  scheduled_at timestamptz,
  shot_at timestamptz,
  delivered_at timestamptz,
  paid_at timestamptz,
  matterport_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_shoots_contact_id on shoots(contact_id);
create index idx_shoots_status on shoots(status);
create index idx_shoots_scheduled_at on shoots(scheduled_at);

-- ─── INVOICES ────────────────────────────────────────────────────────────────

create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');

create table invoices (
  id uuid primary key default uuid_generate_v4(),
  shoot_id uuid references shoots(id) on delete set null,
  contact_id uuid not null references contacts(id) on delete restrict,
  wave_invoice_id text,
  amount numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  subtotal numeric(10, 2) not null,
  gst numeric(10, 2) not null default 0,
  qst numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  status invoice_status not null default 'draft',
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invoices_contact_id on invoices(contact_id);
create index idx_invoices_status on invoices(status);

-- ─── TOURS ───────────────────────────────────────────────────────────────────

create type tour_status as enum ('active', 'archived');

create table tours (
  id uuid primary key default uuid_generate_v4(),
  shoot_id uuid references shoots(id) on delete set null,
  matterport_id text not null,
  title text,
  status tour_status not null default 'active',
  views integer not null default 0,
  listing_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tours_matterport_id_unique unique (matterport_id)
);

create index idx_tours_status on tours(status);

-- ─── LISTINGS ────────────────────────────────────────────────────────────────

create type listing_status as enum ('active', 'sold', 'expired', 'unknown');

create table listings (
  id uuid primary key default uuid_generate_v4(),
  address text not null,
  mls_number text,
  agent_name text,
  contact_id uuid references contacts(id) on delete set null,
  status listing_status not null default 'unknown',
  price numeric(12, 2),
  realtor_url text,
  last_checked timestamptz,
  created_at timestamptz not null default now()
);

-- FK from tours to listings (deferred to avoid circular deps)
alter table tours add constraint tours_listing_id_fk
  foreign key (listing_id) references listings(id) on delete set null;

create index idx_listings_status on listings(status);
create index idx_listings_mls_number on listings(mls_number);

-- ─── MARKETING SPEND ─────────────────────────────────────────────────────────

create type ad_channel as enum ('meta', 'google', 'instagram_promoted', 'other');

create table marketing_spend (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  channel ad_channel not null,
  campaign_name text,
  amount_spent numeric(10, 2) not null,
  impressions integer,
  clicks integer,
  leads_generated integer,
  created_at timestamptz not null default now()
);

create index idx_marketing_spend_date on marketing_spend(date);

-- ─── REVENUE EVENTS ──────────────────────────────────────────────────────────

create type revenue_source as enum (
  'cold_email',
  'instagram_dm',
  'referral',
  'meta_ad',
  'google_ad',
  'organic',
  'formspree'
);

create table revenue_events (
  id uuid primary key default uuid_generate_v4(),
  source revenue_source not null,
  contact_id uuid references contacts(id) on delete set null,
  shoot_id uuid references shoots(id) on delete set null,
  amount numeric(10, 2) not null,
  date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_revenue_events_date on revenue_events(date);
create index idx_revenue_events_source on revenue_events(source);

-- ─── CONTENT CALENDAR ────────────────────────────────────────────────────────

create type content_pillar as enum (
  'the_work',
  'the_edge',
  'the_process',
  'the_proof',
  'the_culture'
);

create type content_status as enum ('draft', 'scheduled', 'posted', 'analyzed');
create type content_platform as enum ('instagram', 'other');

create table content_calendar (
  id uuid primary key default uuid_generate_v4(),
  platform content_platform not null default 'instagram',
  content_type text not null,
  pillar content_pillar not null,
  caption_fr text,
  caption_en text,
  media_url text,
  scheduled_at timestamptz,
  posted_at timestamptz,
  status content_status not null default 'draft',
  engagement_metrics jsonb,
  created_at timestamptz not null default now()
);

create index idx_content_calendar_status on content_calendar(status);
create index idx_content_calendar_scheduled_at on content_calendar(scheduled_at);
create index idx_content_calendar_pillar on content_calendar(pillar);

-- ─── ANALYTICS DAILY ─────────────────────────────────────────────────────────

create table analytics_daily (
  id uuid primary key default uuid_generate_v4(),
  date date not null unique,
  emails_sent integer not null default 0,
  emails_opened integer not null default 0,
  replies integer not null default 0,
  shoots_booked integer not null default 0,
  revenue numeric(10, 2) not null default 0,
  ad_spend numeric(10, 2) not null default 0,
  instagram_followers integer,
  website_visits integer,
  created_at timestamptz not null default now()
);

create index idx_analytics_daily_date on analytics_daily(date);

-- ─── NOTES ───────────────────────────────────────────────────────────────────

create table notes (
  id uuid primary key default uuid_generate_v4(),
  content text not null,
  category text,
  created_at timestamptz not null default now()
);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_updated_at
  before update on contacts
  for each row execute function update_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
-- Single user dashboard — restrict all tables to authenticated users only.

alter table contacts enable row level security;
alter table campaigns enable row level security;
alter table outreach_emails enable row level security;
alter table shoots enable row level security;
alter table invoices enable row level security;
alter table tours enable row level security;
alter table listings enable row level security;
alter table marketing_spend enable row level security;
alter table revenue_events enable row level security;
alter table content_calendar enable row level security;
alter table analytics_daily enable row level security;
alter table notes enable row level security;

-- Policy: only authenticated users can do anything
do $$
declare
  t text;
begin
  foreach t in array array[
    'contacts', 'campaigns', 'outreach_emails', 'shoots', 'invoices',
    'tours', 'listings', 'marketing_spend', 'revenue_events',
    'content_calendar', 'analytics_daily', 'notes'
  ] loop
    execute format(
      'create policy "%s_auth_only" on %I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;
