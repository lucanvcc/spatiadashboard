-- ============================================================
-- Cron Logs, Settings, and Alerts — Phase 4 Automation Engine
-- ============================================================

-- ─── EXTEND TOUR STATUS ──────────────────────────────────────────────────────

alter type tour_status add value if not exists 'archive_recommended';

-- ─── CRON LOGS ───────────────────────────────────────────────────────────────

create table if not exists cron_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('success', 'error')),
  result_summary text,
  ran_at timestamptz not null default now(),
  duration_ms integer
);

create index if not exists idx_cron_logs_job_name on cron_logs(job_name);
create index if not exists idx_cron_logs_ran_at on cron_logs(ran_at desc);

alter table cron_logs enable row level security;
create policy "owner only" on cron_logs for all using (true);

-- ─── SETTINGS ────────────────────────────────────────────────────────────────

create table if not exists settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table settings enable row level security;
create policy "owner only" on settings for all using (true);

-- Default settings
insert into settings (key, value) values
  ('matterport_slot_limit', '25'),
  ('monthly_revenue_goal', '3000'),
  ('weekly_outreach_target', '20'),
  ('cron_listing_monitor_enabled', 'true'),
  ('cron_followup_reminder_enabled', 'true'),
  ('cron_analytics_snapshot_enabled', 'true'),
  ('cron_tour_slot_check_enabled', 'true'),
  ('cron_tax_threshold_enabled', 'true'),
  ('cron_invoice_overdue_enabled', 'true')
on conflict (key) do nothing;

-- ─── ALERTS ──────────────────────────────────────────────────────────────────

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,          -- 'slot_warning', 'tax_threshold', 'invoice_overdue', 'followup_due', 'sold_listing'
  message text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_alerts_type on alerts(type);
create index if not exists idx_alerts_dismissed on alerts(dismissed) where dismissed = false;

alter table alerts enable row level security;
create policy "owner only" on alerts for all using (true);

-- ─── LISTINGS — extend existing table ────────────────────────────────────────

alter table listings add column if not exists last_checked_at timestamptz;
alter table listings add column if not exists sold_detected_at timestamptz;
