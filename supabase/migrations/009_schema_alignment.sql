-- ============================================================
-- Schema Alignment — Phase 4 QA
-- Adds: email_templates, analytics_daily.shoots_completed,
--        Phase 2 ad tables (ad_accounts, ad_campaigns, ad_sets,
--        ad_creatives, ad_metrics, social_post_metrics,
--        campaign_attributions)
-- Run after 008_spatia_os.sql
-- ============================================================

-- ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────
-- Defined in CLAUDE.md core schema but missing from all prior migrations.

create table if not exists email_templates (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  subject_template text not null,
  body_template    text not null,
  language         text not null default 'fr'
                     check (language in ('fr', 'en', 'bilingual')),
  variables_schema jsonb,   -- e.g. ["agent_name","agency","listing_address","compliment","cta"]
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_email_templates_language on email_templates(language);

alter table email_templates enable row level security;
create policy "email_templates_auth_only" on email_templates
  for all to authenticated using (true) with check (true);

-- Seed the four template stubs described in CLAUDE.md
insert into email_templates (name, subject_template, body_template, language, variables_schema)
values
  (
    'Cold Outreach FR',
    'Votre annonce au {listing_address}',
    E'Bonjour {agent_name},\n\n{compliment}\n\nSpatia offre des visites virtuelles 3D Matterport avec livraison le jour même — un avantage réel pour vos clients acheteurs.\n\nSeriez-vous ouvert à un essai ? {cta}\n\nCordialement,\nLuca\nSpatia | spatia.ca',
    'fr',
    '["agent_name","agency","listing_address","compliment","cta"]'
  ),
  (
    'Follow-up FR',
    'Suite — {listing_address}',
    E'Bonjour {agent_name},\n\nJe reviens brièvement suite à mon message de la semaine dernière concernant vos visites virtuelles.\n\n{compliment}\n\nSi ce n''est pas le bon moment, aucun souci.\n\nCordialement,\nLuca\nSpatia | spatia.ca',
    'fr',
    '["agent_name","listing_address","compliment"]'
  ),
  (
    'Post-shoot Delivery',
    'Votre visite virtuelle est prête — {listing_address}',
    E'Bonjour {agent_name},\n\nVotre visite virtuelle Matterport est maintenant en ligne :\n{cta}\n\nLa facture vous a été envoyée séparément.\n\nMerci,\nLuca\nSpatia | spatia.ca',
    'fr',
    '["agent_name","listing_address","cta"]'
  ),
  (
    'Thank You / Referral Ask',
    'Merci — et une petite question',
    E'Bonjour {agent_name},\n\nMerci encore pour votre confiance ! J''espère que la visite a bien servi votre annonce.\n\nSi vous connaissez des collègues qui pourraient bénéficier du même service, je serais ravi qu''ils me contactent.\n\nBonne continuation,\nLuca\nSpatia | spatia.ca',
    'fr',
    '["agent_name"]'
  )
on conflict do nothing;

-- updated_at trigger
create trigger email_templates_updated_at
  before update on email_templates
  for each row execute function update_updated_at();

-- ─── ANALYTICS DAILY — shoots_completed ──────────────────────────────────────
-- CLAUDE.md schema spec includes shoots_completed but 001_initial_schema.sql omitted it.

alter table analytics_daily
  add column if not exists shoots_completed integer not null default 0;

-- ─── PHASE 2: AD ACCOUNTS ────────────────────────────────────────────────────
-- Top-level ad platform accounts (Meta Business, Google Ads, etc.)

create table if not exists ad_accounts (
  id           uuid primary key default gen_random_uuid(),
  platform     text not null check (platform in ('meta', 'google', 'instagram_promoted', 'other')),
  account_id   text not null,          -- external platform account ID
  account_name text not null,
  currency     text not null default 'CAD',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint ad_accounts_platform_account_id_unique unique (platform, account_id)
);

alter table ad_accounts enable row level security;
create policy "ad_accounts_auth_only" on ad_accounts
  for all to authenticated using (true) with check (true);

-- ─── PHASE 2: AD CAMPAIGNS ───────────────────────────────────────────────────

create table if not exists ad_campaigns (
  id                   uuid primary key default gen_random_uuid(),
  ad_account_id        uuid not null references ad_accounts(id) on delete cascade,
  external_campaign_id text,            -- platform-side ID
  name                 text not null,
  status               text not null default 'active'
                         check (status in ('active', 'paused', 'completed', 'draft')),
  objective            text,            -- e.g. 'lead_generation', 'awareness', 'conversions'
  budget_daily         numeric(10, 2),
  budget_total         numeric(10, 2),
  start_date           date,
  end_date             date,
  created_at           timestamptz not null default now()
);

create index if not exists idx_ad_campaigns_ad_account_id on ad_campaigns(ad_account_id);
create index if not exists idx_ad_campaigns_status on ad_campaigns(status);

alter table ad_campaigns enable row level security;
create policy "ad_campaigns_auth_only" on ad_campaigns
  for all to authenticated using (true) with check (true);

-- ─── PHASE 2: AD SETS ────────────────────────────────────────────────────────

create table if not exists ad_sets (
  id                uuid primary key default gen_random_uuid(),
  ad_campaign_id    uuid not null references ad_campaigns(id) on delete cascade,
  external_adset_id text,
  name              text not null,
  status            text not null default 'active'
                      check (status in ('active', 'paused', 'completed', 'draft')),
  targeting_summary text,              -- free-text description of audience
  budget_daily      numeric(10, 2),
  created_at        timestamptz not null default now()
);

create index if not exists idx_ad_sets_ad_campaign_id on ad_sets(ad_campaign_id);

alter table ad_sets enable row level security;
create policy "ad_sets_auth_only" on ad_sets
  for all to authenticated using (true) with check (true);

-- ─── PHASE 2: AD CREATIVES ───────────────────────────────────────────────────

create table if not exists ad_creatives (
  id                   uuid primary key default gen_random_uuid(),
  ad_set_id            uuid references ad_sets(id) on delete set null,
  external_creative_id text,
  name                 text not null,
  creative_type        text not null default 'image'
                         check (creative_type in ('image', 'video', 'carousel', 'story', 'other')),
  headline             text,
  body                 text,
  cta_text             text,
  media_url            text,
  created_at           timestamptz not null default now()
);

create index if not exists idx_ad_creatives_ad_set_id on ad_creatives(ad_set_id);

alter table ad_creatives enable row level security;
create policy "ad_creatives_auth_only" on ad_creatives
  for all to authenticated using (true) with check (true);

-- ─── PHASE 2: AD METRICS ─────────────────────────────────────────────────────
-- Daily performance metrics per campaign (optionally broken down by ad_set).

create table if not exists ad_metrics (
  id             uuid primary key default gen_random_uuid(),
  ad_campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  ad_set_id      uuid references ad_sets(id) on delete set null,
  date           date not null,
  impressions    integer not null default 0,
  clicks         integer not null default 0,
  spend          numeric(10, 2) not null default 0,
  leads          integer not null default 0,
  conversions    integer not null default 0,
  reach          integer,
  frequency      numeric(6, 2),
  cpm            numeric(10, 4),   -- cost per 1000 impressions
  cpc            numeric(10, 4),   -- cost per click
  cpl            numeric(10, 4),   -- cost per lead
  roas           numeric(10, 4),   -- return on ad spend
  created_at     timestamptz not null default now(),
  constraint ad_metrics_campaign_adset_date_unique unique (ad_campaign_id, ad_set_id, date)
);

create index if not exists idx_ad_metrics_campaign_date on ad_metrics(ad_campaign_id, date desc);
create index if not exists idx_ad_metrics_date on ad_metrics(date desc);

alter table ad_metrics enable row level security;
create policy "ad_metrics_auth_only" on ad_metrics
  for all to authenticated using (true) with check (true);

-- ─── PHASE 2: SOCIAL POST METRICS ────────────────────────────────────────────
-- Per-post engagement metrics, linked to content_calendar where applicable.

create table if not exists social_post_metrics (
  id                  uuid primary key default gen_random_uuid(),
  content_calendar_id uuid references content_calendar(id) on delete set null,
  platform            text not null default 'instagram'
                        check (platform in ('instagram', 'tiktok', 'youtube', 'linkedin', 'facebook', 'other')),
  post_id             text,          -- platform-native post ID
  date                date not null,
  likes               integer not null default 0,
  comments            integer not null default 0,
  saves               integer not null default 0,
  shares              integer not null default 0,
  reach               integer,
  impressions         integer,
  profile_visits      integer,
  created_at          timestamptz not null default now()
);

create index if not exists idx_social_post_metrics_content_id on social_post_metrics(content_calendar_id);
create index if not exists idx_social_post_metrics_date on social_post_metrics(date desc);

alter table social_post_metrics enable row level security;
create policy "social_post_metrics_auth_only" on social_post_metrics
  for all to authenticated using (true) with check (true);

-- ─── PHASE 2: CAMPAIGN ATTRIBUTIONS ─────────────────────────────────────────
-- Links a contact/booking/revenue event back to the ad campaign that generated it.

create table if not exists campaign_attributions (
  id                 uuid primary key default gen_random_uuid(),
  contact_id         uuid not null references contacts(id) on delete cascade,
  ad_campaign_id     uuid references ad_campaigns(id) on delete set null,
  shoot_id           uuid references shoots(id) on delete set null,
  revenue_event_id   uuid references revenue_events(id) on delete set null,
  attribution_channel text not null
                       check (attribution_channel in ('meta', 'google', 'instagram_promoted', 'organic', 'referral', 'cold_email', 'formspree', 'other')),
  attribution_date   date not null,
  revenue_attributed numeric(10, 2),
  created_at         timestamptz not null default now()
);

create index if not exists idx_campaign_attributions_contact_id on campaign_attributions(contact_id);
create index if not exists idx_campaign_attributions_campaign_id on campaign_attributions(ad_campaign_id);
create index if not exists idx_campaign_attributions_date on campaign_attributions(attribution_date desc);

alter table campaign_attributions enable row level security;
create policy "campaign_attributions_auth_only" on campaign_attributions
  for all to authenticated using (true) with check (true);
