-- ============================================================
-- Weekly Reports — Phase 5
-- ============================================================

-- ─── WEEKLY REPORTS ──────────────────────────────────────────────────────────

create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_number integer not null,
  year integer not null,
  data_json jsonb not null,
  created_at timestamptz not null default now(),
  constraint weekly_reports_week_unique unique (year, week_number)
);

create index if not exists idx_weekly_reports_year_week on weekly_reports(year desc, week_number desc);

alter table weekly_reports enable row level security;
create policy "owner only" on weekly_reports for all using (true);

-- ─── SETTINGS — weekly report cron ───────────────────────────────────────────

insert into settings (key, value) values
  ('cron_weekly_report_enabled', 'true')
on conflict (key) do nothing;
