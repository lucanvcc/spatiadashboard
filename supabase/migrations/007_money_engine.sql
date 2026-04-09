-- ============================================================
-- Money Engine — Wave Integration + Financial Dashboard
-- Phase: MONEY ENGINE — Run after 006_scraper.sql
-- ============================================================

-- ─── EXTEND CONTACTS ──────────────────────────────────────────────────────────

alter table contacts add column if not exists wave_customer_id text;

-- ─── EXTEND INVOICES ──────────────────────────────────────────────────────────
-- wave_invoice_id, subtotal, gst, qst, discount already exist
-- Adding: source_system, wave_invoice_url, notes

alter table invoices add column if not exists source_system text not null default 'manual';
alter table invoices add column if not exists wave_invoice_url text;
alter table invoices add column if not exists notes text;

-- Unique index on wave_invoice_id (partial — exclude NULLs)
create unique index if not exists idx_invoices_wave_invoice_id_unique
  on invoices(wave_invoice_id)
  where wave_invoice_id is not null;

-- ─── IMPORT BATCHES ───────────────────────────────────────────────────────────

create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  uploaded_at timestamptz not null default now(),
  total_rows integer not null default 0,
  matched_rows integer not null default 0,
  partial_rows integer not null default 0,
  failed_rows integer not null default 0,
  skipped_rows integer not null default 0,
  status text not null default 'processing',
  source_type text not null default 'wave_invoices'
);

create index if not exists idx_import_batches_uploaded_at on import_batches(uploaded_at desc);
create index if not exists idx_import_batches_status on import_batches(status);

alter table import_batches enable row level security;
create policy "import_batches_auth_only" on import_batches
  for all to authenticated using (true) with check (true);

-- ─── WAVE RAW IMPORTS ─────────────────────────────────────────────────────────

create table if not exists wave_raw_imports (
  id uuid primary key default gen_random_uuid(),
  imported_at timestamptz not null default now(),
  filename text not null,
  row_index integer not null,
  row_raw jsonb not null,
  parsed_status text not null default 'pending',
  matched_invoice_id uuid references invoices(id) on delete set null,
  matched_contact_id uuid references contacts(id) on delete set null,
  error_message text,
  import_batch_id uuid not null references import_batches(id) on delete cascade
);

create index if not exists idx_wave_raw_imports_batch on wave_raw_imports(import_batch_id);
create index if not exists idx_wave_raw_imports_status on wave_raw_imports(parsed_status);

alter table wave_raw_imports enable row level security;
create policy "wave_raw_imports_auth_only" on wave_raw_imports
  for all to authenticated using (true) with check (true);

-- ─── EXPENSES ─────────────────────────────────────────────────────────────────

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null,
  description text not null,
  amount numeric(10, 2) not null,
  gst_paid numeric(10, 2) not null default 0,
  qst_paid numeric(10, 2) not null default 0,
  vendor text,
  receipt_url text,
  source_system text not null default 'manual',
  wave_transaction_id text,
  import_batch_id uuid references import_batches(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_expenses_wave_transaction_id
  on expenses(wave_transaction_id)
  where wave_transaction_id is not null;

create index if not exists idx_expenses_date on expenses(date);
create index if not exists idx_expenses_category on expenses(category);

alter table expenses enable row level security;
create policy "expenses_auth_only" on expenses
  for all to authenticated using (true) with check (true);

-- ─── TAX SUMMARY SNAPSHOTS ────────────────────────────────────────────────────

create table if not exists tax_summary_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  total_revenue numeric(10, 2) not null,
  gst_collected numeric(10, 2) not null,
  qst_collected numeric(10, 2) not null,
  gst_paid numeric(10, 2) not null default 0,
  qst_paid numeric(10, 2) not null default 0,
  net_gst_owing numeric(10, 2) not null,
  net_qst_owing numeric(10, 2) not null,
  cumulative_ytd_revenue numeric(10, 2) not null,
  threshold_30k_pct numeric(10, 2) not null,
  snapshot_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tax_snapshots_period on tax_summary_snapshots(period_start desc);
create index if not exists idx_tax_snapshots_type on tax_summary_snapshots(snapshot_type);

alter table tax_summary_snapshots enable row level security;
create policy "tax_summary_snapshots_auth_only" on tax_summary_snapshots
  for all to authenticated using (true) with check (true);

-- ─── EXTEND REVENUE EVENTS ────────────────────────────────────────────────────
-- invoice_id: link revenue event to the specific invoice
-- wave_import_batch_id: track which import created this event

alter table revenue_events add column if not exists invoice_id uuid references invoices(id) on delete set null;
alter table revenue_events add column if not exists wave_import_batch_id uuid references import_batches(id) on delete set null;

create index if not exists idx_revenue_events_invoice_id on revenue_events(invoice_id);

-- ─── SETTINGS — money engine crons ────────────────────────────────────────────

insert into settings (key, value) values
  ('cron_tax_snapshot_enabled', 'true')
on conflict (key) do nothing;
