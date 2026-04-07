-- ============================================================
-- Spatia Scraper Module — scrape_logs table
-- Run after 005_weekly_reports.sql
-- ============================================================

create table if not exists scrape_logs (
  id uuid primary key default uuid_generate_v4(),
  query text not null,
  results_count integer not null default 0,
  imported_count integer not null default 0,
  ran_at timestamptz not null default now(),
  meta jsonb
);

create index if not exists idx_scrape_logs_ran_at on scrape_logs(ran_at desc);

-- RLS
alter table scrape_logs enable row level security;

create policy "owner full access" on scrape_logs
  for all
  using (true)
  with check (true);
