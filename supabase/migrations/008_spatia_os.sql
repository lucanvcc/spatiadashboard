-- ============================================================
-- Spatia OS — Jarvis Command Center
-- Phase 3: action_items, command_log, cron_logs extension
-- Run after 007_money_engine.sql
-- ============================================================

-- ─── ACTION ITEMS ─────────────────────────────────────────────────────────────

create table if not exists action_items (
  id                   uuid primary key default gen_random_uuid(),
  type                 text not null,
  severity             text not null default 'info'
                         check (severity in ('critical', 'warning', 'info', 'success')),
  title                text not null,
  description          text,
  related_entity_type  text,   -- 'contact' | 'invoice' | 'shoot' | 'tour' | 'listing' | 'campaign' | 'cron_job'
  related_entity_id    uuid,   -- FK enforced at app level (multi-table)
  related_url          text,
  source               text not null default 'manual',
  is_resolved          boolean not null default false,
  resolved_at          timestamptz,
  resolved_by          text,   -- 'user' | 'cron' | 'system'
  resolution_note      text,
  is_dismissed         boolean not null default false,
  dismissed_at         timestamptz,
  expires_at           timestamptz,
  data                 jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Primary query pattern: active items sorted by severity + date
create index if not exists idx_action_items_active
  on action_items(is_resolved, is_dismissed, severity, created_at desc)
  where is_resolved = false and is_dismissed = false;

create index if not exists idx_action_items_severity
  on action_items(severity);

create index if not exists idx_action_items_type
  on action_items(type);

create index if not exists idx_action_items_created_at
  on action_items(created_at desc);

create index if not exists idx_action_items_entity
  on action_items(related_entity_type, related_entity_id)
  where related_entity_type is not null;

-- Deduplication: prevent same alert from being created multiple times on the same day
-- Uses date-trunc so repeated cron runs don't spam
create unique index if not exists idx_action_items_daily_dedup
  on action_items(
    type,
    coalesce(related_entity_type, ''),
    coalesce(related_entity_id::text, ''),
    date_trunc('day', created_at at time zone 'UTC')
  )
  where is_resolved = false and is_dismissed = false;

alter table action_items enable row level security;
create policy "owner only" on action_items for all using (true);

-- ─── COMMAND LOG ──────────────────────────────────────────────────────────────

create table if not exists command_log (
  id          uuid primary key default gen_random_uuid(),
  command     text not null,
  params      jsonb,
  executed_at timestamptz not null default now()
);

create index if not exists idx_command_log_executed_at
  on command_log(executed_at desc);

alter table command_log enable row level security;
create policy "owner only" on command_log for all using (true);

-- ─── EXTEND CRON_LOGS ────────────────────────────────────────────────────────

alter table cron_logs add column if not exists action_items_created integer not null default 0;

-- ─── SETTINGS — new keys ──────────────────────────────────────────────────────

insert into settings (key, value) values
  ('cron_campaign_health_enabled', 'true'),
  ('cron_shoot_today_enabled', 'true'),
  ('kill_scale_kill_cpr_threshold', '25'),
  ('kill_scale_kill_min_spend', '50'),
  ('kill_scale_scale_roas_threshold', '3'),
  ('kill_scale_scale_min_bookings', '1')
on conflict (key) do nothing;
