-- ============================================================
-- Unified Calendar Events — Phase 3
-- ============================================================

create type event_type as enum ('shoot', 'call', 'post', 'meeting', 'task', 'other');

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type event_type not null default 'other',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  description text,
  location text,
  contact_id uuid references contacts(id) on delete set null,
  -- links to existing records
  shoot_id uuid references shoots(id) on delete cascade,
  content_id uuid references content_calendar(id) on delete cascade,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_calendar_events_starts_at on calendar_events(starts_at);
create index idx_calendar_events_type on calendar_events(event_type);

alter table calendar_events enable row level security;
create policy "owner only" on calendar_events for all using (true);
