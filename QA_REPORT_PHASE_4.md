# QA Report — Phase 4

_Generated: 2026-04-08_

---

## Schema Alignment

### Methodology

Every table and column defined in `CLAUDE.md` was cross-referenced against all eight existing migration files (`001` – `008`). The TypeScript types in `types/index.ts` were then checked against the **actual migration-defined schema** (not just the CLAUDE.md spec). Gaps in either direction were recorded and resolved.

---

### Existing Migrations Reviewed

| File | Contents |
|---|---|
| `001_initial_schema.sql` | contacts, campaigns, outreach_emails, shoots, invoices, tours, listings, marketing_spend, revenue_events, content_calendar, analytics_daily, notes |
| `002_crm_module.sql` | `notes.contact_id`, `email_status.rejected` |
| `003_calendar_events.sql` | calendar_events |
| `004_cron_and_settings.sql` | cron_logs, settings, alerts, `listings.last_checked_at`, `listings.sold_detected_at`, `tour_status.archive_recommended` |
| `005_weekly_reports.sql` | weekly_reports |
| `006_scraper.sql` | scrape_logs |
| `007_money_engine.sql` | import_batches, wave_raw_imports, expenses, tax_summary_snapshots; `contacts.wave_customer_id`; `invoices.source_system`, `.wave_invoice_url`, `.notes`; `revenue_events.invoice_id`, `.wave_import_batch_id` |
| `008_spatia_os.sql` | action_items, command_log; `cron_logs.action_items_created`; new settings keys |

---

### Missing Tables — Added in `009_schema_alignment.sql`

#### `email_templates`
- **Gap**: Defined in CLAUDE.md core schema (`email_templates — Reusable templates with variables`) but absent from all eight migrations.
- **Fix**: Created table with columns `id`, `name`, `subject_template`, `body_template`, `language` (fr/en/bilingual), `variables_schema` (jsonb), `created_at`, `updated_at`. Seeded the four template stubs described in CLAUDE.md (cold outreach FR, follow-up FR, post-shoot delivery, thank-you/referral ask). Added `updated_at` trigger.

#### `ad_accounts`
- **Gap**: Phase 2 ad analytics table not present in any migration.
- **Fix**: Created with `platform`, `account_id`, `account_name`, `currency`, `is_active`. Unique constraint on `(platform, account_id)`.

#### `ad_campaigns`
- **Gap**: Phase 2 table missing.
- **Fix**: Created with FK to `ad_accounts`, `external_campaign_id`, `name`, `status`, `objective`, `budget_daily`, `budget_total`, `start_date`, `end_date`.

#### `ad_sets`
- **Gap**: Phase 2 table missing.
- **Fix**: Created with FK to `ad_campaigns`, `external_adset_id`, `name`, `status`, `targeting_summary`, `budget_daily`.

#### `ad_creatives`
- **Gap**: Phase 2 table missing.
- **Fix**: Created with FK to `ad_sets`, `external_creative_id`, `name`, `creative_type` (image/video/carousel/story/other), `headline`, `body`, `cta_text`, `media_url`.

#### `ad_metrics`
- **Gap**: Phase 2 table missing.
- **Fix**: Created with FK to `ad_campaigns` + optional `ad_sets`, daily grain, `impressions`, `clicks`, `spend`, `leads`, `conversions`, `reach`, `frequency`, `cpm`, `cpc`, `cpl`, `roas`. Unique constraint on `(ad_campaign_id, ad_set_id, date)`.

#### `social_post_metrics`
- **Gap**: Phase 2 table missing.
- **Fix**: Created with optional FK to `content_calendar`, `platform` enum (instagram/tiktok/youtube/linkedin/facebook/other), `post_id`, daily metrics (`likes`, `comments`, `saves`, `shares`, `reach`, `impressions`, `profile_visits`).

#### `campaign_attributions`
- **Gap**: Phase 2 table missing.
- **Fix**: Created with FK to `contacts` (required), optional FKs to `ad_campaigns`, `shoots`, `revenue_events`. `attribution_channel` enum mirrors `revenue_source` plus ad channels. `revenue_attributed` for tracking dollar value.

---

### Missing Columns — Added in `009_schema_alignment.sql`

#### `analytics_daily.shoots_completed`
- **Gap**: CLAUDE.md schema spec explicitly lists `shoots_completed` in `analytics_daily`, but `001_initial_schema.sql` only has `shoots_booked`.
- **Fix**: `ALTER TABLE analytics_daily ADD COLUMN IF NOT EXISTS shoots_completed integer NOT NULL DEFAULT 0`.

---

### TypeScript Type Gaps Fixed (`types/index.ts`)

| Interface | Missing field(s) | Source migration | Fix |
|---|---|---|---|
| `Contact` | `wave_customer_id: string \| null` | 007 | Added |
| `Invoice` | `source_system: string`, `wave_invoice_url: string \| null`, `notes: string \| null` | 007 | Added |
| `Note` | `contact_id: string \| null` | 002 | Added |
| `Listing` | `last_checked_at: string \| null`, `sold_detected_at: string \| null` | 004 | Added |
| `RevenueEvent` | `invoice_id: string \| null`, `wave_import_batch_id: string \| null` | 007 | Added |
| `AnalyticsDaily` | `shoots_completed: number` | 009 | Added |

---

### New Types Added (`types/index.ts`)

| Type / Interface | Source |
|---|---|
| `TemplateLanguage`, `EmailTemplate` | `email_templates` table (009) |
| `AlertSeverity`, `Alert` | `alerts` table (004) |
| `CalendarEventType`, `CalendarEvent` | `calendar_events` table (003) |
| `ScrapeLog` | `scrape_logs` table (006) |
| `CronJobStatus`, `CronLog` | `cron_logs` table (004 + 008) |
| `ActionItemSeverity`, `ActionItemSource`, `ActionItem` | `action_items` table (008) |
| `CommandLog` | `command_log` table (008) |
| `AdPlatform`, `AdAccount` | `ad_accounts` table (009) |
| `AdCampaignStatus`, `AdCampaign` | `ad_campaigns` table (009) |
| `AdSet` | `ad_sets` table (009) |
| `AdCreativeType`, `AdCreative` | `ad_creatives` table (009) |
| `AdMetric` | `ad_metrics` table (009) |
| `SocialPlatform`, `SocialPostMetric` | `social_post_metrics` table (009) |
| `AttributionChannel`, `CampaignAttribution` | `campaign_attributions` table (009) |

---

### Tables Confirmed Present (No Action Needed)

contacts, campaigns, outreach_emails, shoots, invoices, tours, listings, marketing_spend, revenue_events, content_calendar, analytics_daily, notes, cron_logs, settings, weekly_reports, wave_raw_imports, import_batches, expenses, tax_summary_snapshots, action_items, command_log, calendar_events, scrape_logs, alerts

---

### No Stack Changes

No external services were added. No existing migration files were modified. All changes are additive and backward-compatible.

---

## API Routes Audit

_Audited: 2026-04-08_

### Methodology

Every API route listed in CLAUDE.md and the Phase 3 spec was cross-referenced against all `.ts` files under `app/api/`. Each existing route was read in full to verify: (1) authentication enforced on every exported handler, (2) `req.json()` / `req.formData()` calls wrapped in try/catch, (3) Supabase errors surface as 500 responses, (4) correct HTTP method exported.

---

### Routes Confirmed Present and Passing Audit

| Route | File | Auth | Error Handling | Notes |
|---|---|---|---|---|
| `GET /api/cron/trigger/[jobName]` | `app/api/cron/trigger/[jobName]/route.ts` | ✓ | ✓ (after fix) | Handles all 6 registered jobs via `CRON_JOBS` registry |
| `POST /api/webhooks/form-submission` | `app/api/webhooks/form-submission/route.ts` | N/A (public webhook) | ✓ | Uses service role key; no user auth intentional |
| `POST /api/contacts/import` | `app/api/contacts/import/route.ts` | ✓ | ✓ | Handles CSV multipart + JSON; deduplicates on email |
| `POST /api/money/import-wave` | `app/api/money/import-wave/route.ts` | ✓ | ✓ | Full Wave invoice + expense CSV pipeline with batch tracking |
| `GET /api/command/scoreboard` | `app/api/command/scoreboard/route.ts` | ✓ | ✓ | Parallel Supabase fetches; week-over-week delta math |
| `GET /api/command/activity-feed` | `app/api/command/activity-feed/route.ts` | ✓ | ✓ | Aggregates emails, shoots, invoices, imports, cron, actions |
| `GET /api/command/action-items` | `app/api/command/action-items/route.ts` | ✓ | ✓ | Severity filter, expiry filter, client-side sort |
| `POST /api/command/action-items` | `app/api/command/action-items/route.ts` | ✓ | ✓ | Manual action item creation |
| `PATCH /api/command/action-items/[id]` | `app/api/command/action-items/[id]/route.ts` | ✓ | ✓ (after fix) | resolve / dismiss actions |
| `GET /api/command/search` | `app/api/command/search/route.ts` | ✓ | ✓ | Cross-entity search: contacts, shoots, invoices, campaigns |
| `POST /api/command/log` | `app/api/command/log/route.ts` | ✓ | ✓ (after fix) | Inserts into command_log table |

---

### Missing Routes — Created

#### `POST /api/marketing/meta/ads-import`

- **Status before**: Not present (directory `app/api/marketing/` did not exist).
- **Fix**: Created `app/api/marketing/meta/ads-import/route.ts`.
- **Implementation**: Accepts multipart CSV or JSON array. Maps Meta Ads Manager export columns (`Campaign name`, `Day`, `Amount spent (CAD)`, `Impressions`, `Clicks (all)`, `Results`, `Reach`) into `marketing_spend` rows with `channel = 'meta'`. Skips rows missing a parseable date. Silently skips duplicate constraint violations (`23505`). Returns `{ total, inserted, skipped, failed, errors[] }`.
- **Auth**: Supabase session required — 401 if unauthenticated.
- **Error handling**: Full try/catch around parse + per-row processing.

#### `POST /api/marketing/meta/organic-import`

- **Status before**: Not present.
- **Fix**: Created `app/api/marketing/meta/organic-import/route.ts`.
- **Implementation**: Accepts multipart CSV or JSON array. Accepts optional `?platform=instagram|tiktok|…` query param (default: `instagram`). Maps Instagram Insights export columns (`Post ID`, `Date`, `Likes`, `Comments`, `Saves`, `Shares`, `Reach`, `Impressions`, `Profile visits`, `Content calendar ID`) into `social_post_metrics` rows. Skips rows with no engagement data or unparseable dates. Returns `{ total, inserted, skipped, failed, errors[] }`.
- **Auth**: Supabase session required — 401 if unauthenticated.
- **Error handling**: Full try/catch around parse + per-row processing.

---

### Existing Routes Fixed

#### `/api/cron/trigger/[jobName]/route.ts` — missing try/catch

- **Issue**: `await job.fn()` had no try/catch. An unhandled exception from any cron job function would crash the request with an unformatted 500.
- **Fix**: Wrapped in try/catch; returns `{ error: "Job failed: <message>" }` with status 500.

#### `/api/command/log/route.ts` — missing try/catch + no DB error surface

- **Issue**: `await req.json()` unguarded (malformed body = unhandled exception). Supabase insert error was silently ignored.
- **Fix**: Added try/catch around `req.json()`; surface Supabase insert error as 500.

#### `/api/command/action-items/[id]/route.ts` — missing try/catch

- **Issue**: `await req.json()` unguarded on the PATCH handler.
- **Fix**: Added try/catch; returns `{ error: "Invalid JSON" }` with status 400.

#### `/api/marketing-spend/route.ts` — missing auth on all three handlers

- **Issue**: GET, POST, DELETE had no authentication check. Any unauthenticated caller could read or modify marketing spend data.
- **Fix**: Added `supabase.auth.getUser()` guard (401 if no user) to all three exported handlers. Also added try/catch around `req.json()` in POST and input validation for required fields (`date`, `channel`, `amount_spent`).

---

### No Changes Needed

The following routes were verified as already correct (auth present, errors handled):

`/api/contacts/route.ts`, `/api/contacts/[id]/route.ts`, `/api/contacts/search/route.ts`, `/api/outreach/emails/route.ts`, `/api/outreach/emails/[id]/route.ts`, `/api/outreach/emails/[id]/send/route.ts`, `/api/outreach/analytics/route.ts`, `/api/outreach/campaigns/route.ts`, `/api/outreach/campaigns/[id]/route.ts`, `/api/shoots/route.ts`, `/api/shoots/[id]/route.ts`, `/api/invoices/route.ts`, `/api/tours/route.ts`, `/api/notes/route.ts`, `/api/content/route.ts`, `/api/calendar/events/route.ts`, `/api/cron/status/route.ts`, `/api/cron/toggle/route.ts`, `/api/money/import-wave/[batchId]/route.ts`, `/api/money/import-wave/[batchId]/rows/[rowId]/route.ts`, `/api/money/expenses/route.ts`, `/api/money/expenses/[id]/route.ts`, `/api/reports/weekly/route.ts`, `/api/health/route.ts`

---

### Summary

| Category | Count |
|---|---|
| Routes audited | 42 |
| Missing routes created | 2 |
| Existing routes fixed | 4 |
| Routes passing with no changes | 36 |

---

## Cron Jobs Audit

_Audited: 2026-04-08_

### Methodology

Every job in `lib/cron/index.ts` was verified for: (1) correct schedule string, (2) cron_logs persistence with all required fields, (3) try/catch isolation so a failure cannot crash the process, (4) action_items writes where applicable. Each implementation file was read in full.

---

### Centralized Infrastructure — `lib/cron/run-job.ts`

All jobs delegate to the `runCronJob(name, fn)` wrapper. This wrapper provides:

- **cron_logs write**: Inserts `job_name`, `status` ("success" | "error"), `result_summary`, `ran_at` (ISO timestamp), `duration_ms`, `action_items_created` on every run.
- **Error isolation**: Wraps `fn()` in try/catch. On exception, logs status="error" with the error message and returns `"ERROR: <message>"` — the exception is never re-thrown, so the cron scheduler process cannot crash.
- **Consistent return**: Always returns a string summary, usable by the manual trigger endpoint.

---

### Registration Audit — `lib/cron/index.ts`

| Job | Expected schedule | Registered schedule | Status |
|---|---|---|---|
| `listing-monitor` | Daily 2:00 AM (`0 2 * * *`) | `0 2 * * *` | ✓ |
| `followup-reminder` | Daily 9:00 AM (`0 9 * * *`) | `0 9 * * *` | ✓ |
| `analytics-snapshot` | Daily 11:59 PM (`59 23 * * *`) | `59 23 * * *` | ✓ |
| `tour-slot-check` | Daily 6:00 AM (`0 6 * * *`) | `0 6 * * *` | ✓ |
| `tax-threshold` | Monday 8:00 AM (`0 8 * * 1`) | `0 8 * * 1` | ✓ |
| `invoice-overdue` | Daily 8:00 AM (`0 8 * * *`) | `0 8 * * *` | ✓ |
| `campaign-health` (Phase 3) | Daily 7:00 AM (`0 7 * * *`) | `0 7 * * *` | ✓ |
| `shoot-today` (Phase 3) | Daily 6:30 AM (`30 6 * * *`) | `30 6 * * *` | ✓ |
| `weekly-report` (bonus) | Monday 7:00 AM (`0 7 * * 1`) | `0 7 * * 1` | ✓ |

Hot-reload guard (`globalForCron.__cronRegistered`) prevents duplicate registration in dev. All 9 jobs use the CRON_JOBS registry, which is also consumed by the `/api/cron/trigger/[jobName]` endpoint.

---

### Per-Job Implementation Audit

| Job | Logging via wrapper | try/catch via wrapper | action_items writes | Notes |
|---|---|---|---|---|
| `listing-monitor` | ✓ | ✓ | ✓ (`listing_sold`) | Also updates legacy `alerts` table |
| `followup-reminder` | ✓ | ✓ | ✓ (`followup_due`) | Tags contact with `followup_due`; checks for existing replies before flagging |
| `analytics-snapshot` | ✓ | ✓ | N/A | Aggregation job — no action items expected |
| `tour-slot-check` | ✓ | ✓ | ✓ (`slot_warning`) | Auto-resolves existing slot_warning items when below threshold |
| `tax-threshold` | ✓ | ✓ | ✓ (`tax_threshold`) | Writes `tax_summary_snapshots` row every run; also writes legacy `alerts` |
| `invoice-overdue` | ✓ | ✓ | ✓ (`invoice_overdue`) | Updates invoice status to "overdue"; severity escalates after 14 days |
| `campaign-health` | ✓ | ✓ | ✓ (`campaign_waste`, `campaign_scale`) | Uses configurable kill/scale thresholds from `settings` table |
| `shoot-today` | ✓ | ✓ | ✓ (`shoot_today`, `shoot_tomorrow`) | Sets `expires_at` on action items so they auto-expire at end of their day |

---

### Bug Fixed

#### `lib/cron/analytics-snapshot.ts` — `shoots_completed` written to wrong column

- **Issue**: Migration `009_schema_alignment.sql` added a dedicated `shoots_completed` column to `analytics_daily`. The snapshot job was not writing to it — instead it folded `shootsCompleted` into `shoots_booked` (`shoots_booked: (shootsBooked ?? 0) + (shootsCompleted ?? 0)`). This caused: (a) `shoots_booked` count inflated by delivered shoots, (b) `shoots_completed` always remaining 0.
- **Fix**: Separated the two fields in the upsert:
  ```ts
  // Before (wrong)
  shoots_booked: (shootsBooked ?? 0) + (shootsCompleted ?? 0),

  // After (correct)
  shoots_booked: shootsBooked ?? 0,
  shoots_completed: shootsCompleted ?? 0,
  ```
- **File**: `lib/cron/analytics-snapshot.ts`, line 92.

---

### No Other Issues Found

All jobs correctly delegate to `runCronJob`, which provides centralized logging and error isolation. No job can crash the cron process. All Phase 3 jobs (`campaign-health`, `shoot-today`) are registered, write action items, and are covered by the wrapper.

---

### Summary

| Category | Count |
|---|---|
| Jobs audited | 9 |
| Registration gaps | 0 |
| Logging gaps | 0 |
| try/catch gaps | 0 |
| action_items gaps | 0 |
| Bugs fixed | 1 (`analytics-snapshot` shoots_completed column) |

---

## Pages Audit

_Audited: 2026-04-08_

### Methodology

Every page route listed in the task spec was located in `app/(dashboard)/` and read in full. Each existing page was checked for: (1) actual Supabase queries vs. hardcoded mock data, (2) correct table references per CLAUDE.md schema, (3) working data fetching (server component queries or real client-side API fetches). Missing pages were created with full dark-mode Tailwind + shadcn/ui styling matching the existing aesthetic.

---

### Pages Confirmed Present — Real Supabase Queries

| Route | File | Data source | Notes |
|---|---|---|---|
| `/` | `app/(dashboard)/page.tsx` | `revenue_events`, `shoots`, `contacts`, `tours`, `outreach_emails`, `invoices` | Server component; 9 parallel Supabase queries |
| `/crm` | `app/(dashboard)/crm/page.tsx` | `contacts` (all fields) | Real Supabase query; KanbanBoard client component |
| `/outreach` | `app/(dashboard)/outreach/page.tsx` | `GET /api/outreach/emails?status=pending_review` | Client component; real API fetch |
| `/marketing` | `app/(dashboard)/marketing/page.tsx` | `GET /api/marketing-spend`, `GET /api/revenue-by-source` | Client MarketingDashboard; real API fetches |
| `/operations` | `app/(dashboard)/operations/page.tsx` | — | Redirects to `/operations/shoots` |
| `/operations/shoots` | `app/(dashboard)/operations/shoots/page.tsx` | `contacts` | ShootsList client fetches `/api/shoots` |
| `/operations/tours` | `app/(dashboard)/operations/tours/page.tsx` | — | ToursManager client fetches `/api/tours` + `/api/settings` |
| `/operations/invoices` | `app/(dashboard)/operations/invoices/page.tsx` | `contacts` | InvoicesTracker fetches `/api/invoices` |
| `/settings` | `app/(dashboard)/settings/page.tsx` | — | Navigation hub; links to `/settings/cron` |
| `/settings/cron` | `app/(dashboard)/settings/cron/page.tsx` | `GET /api/cron/status` | Real API fetch |
| `/money` | `app/(dashboard)/money/page.tsx` | `invoices`, `expenses`, `contacts` | Server component; 8 parallel queries |
| `/money/import-wave` | `app/(dashboard)/money/import-wave/page.tsx` | `contacts` | WaveImportClient posts to `/api/money/import-wave` |
| `/money/taxes` | `app/(dashboard)/money/taxes/page.tsx` | `invoices`, `expenses`, `tax_summary_snapshots` | Server component; 3 queries |
| `/money/expenses` | `app/(dashboard)/money/expenses/page.tsx` | `expenses` (MTD/QTD/YTD) | Server component + ExpensesClient |
| `/command` | `app/(dashboard)/command/page.tsx` | `invoices`, `contacts`, `tours`, `settings`, `marketing_spend`, `shoots`, `outreach_emails`, `cron_logs`, `action_items` | Server component; 20 parallel queries |
| `/reports/weekly` | `app/(dashboard)/reports/weekly/page.tsx` | `GET /api/reports/weekly` | Client WeeklyReportView; real API fetch |
| `/content` | `app/(dashboard)/content/page.tsx` | — | ContentCalendar client fetches `/api/content` |

---

### Mock Data Found

**None.** Every existing page uses real Supabase queries or authenticated API routes. No hardcoded arrays, static fixtures, or `Math.random()` demo data detected.

---

### Missing Pages — Created

#### `/money/invoices`

- **Status before**: Not present. The money layout tab bar (`MoneyTabs`) had no invoices tab; invoices were only accessible via `/operations/invoices` in the sidebar.
- **Fix 1 — `components/money/money-tabs.tsx`**: Added `{ href: "/money/invoices", label: "invoices" }` between "overview" and "taxes" in the `TABS` array so the money section has a complete tab set: overview → invoices → taxes → expenses → import wave.
- **Fix 2 — `app/(dashboard)/money/invoices/page.tsx`**: Created server component that queries `contacts` from Supabase, then renders the existing `InvoicesTracker` client component (same as `/operations/invoices`). Subtitle updated to reflect money-module context.

#### `/marketing/meta`

- **Status before**: Directory `app/(dashboard)/marketing/meta/` did not exist.
- **Fix**: Created `app/(dashboard)/marketing/meta/page.tsx` — a full server component page with:
  - **Data**: Parallel queries to `marketing_spend` (channel=meta), `ad_campaigns`, `ad_metrics` — all from real Supabase tables (009 migration).
  - **KPI cards**: spend MTD, impressions MTD, clicks MTD, cost per lead (with month-over-month delta).
  - **Spend history chart**: CSS-only bar chart grouped by month (last 90 days).
  - **Campaigns table**: renders `ad_campaigns` rows joined to aggregated `ad_metrics` with CPL per campaign.
  - **Recent entries table**: last 15 `marketing_spend` rows for the current month.
  - **Empty state**: prompt to import from Meta Ads Manager.
  - **Nav links**: to `/marketing/meta/organic` and `/marketing/meta-import`.

#### `/marketing/meta/organic`

- **Status before**: Directory `app/(dashboard)/marketing/meta/organic/` did not exist.
- **Fix**: Created `app/(dashboard)/marketing/meta/organic/page.tsx` — a full server component page with:
  - **Data**: Parallel queries to `social_post_metrics` (MTD + 90-day history) and a join to `content_calendar` for pillar labels.
  - **KPI cards**: posts tracked, total engagement, avg engagement rate, saves count.
  - **Weekly engagement bar chart**: CSS-only, ISO-week grouped, 90-day window.
  - **By-platform breakdown**: engagement + engagement rate per platform (instagram, tiktok, etc.) with bar visualization.
  - **Posts table**: date, platform, pillar (from content_calendar join), likes, comments, saves, reach, engagement rate — color-coded ≥5% green.
  - **Empty state**: prompt to import Instagram Insights CSV.

#### `/marketing/meta-import`

- **Status before**: Directory `app/(dashboard)/marketing/meta-import/` did not exist. The API routes (`/api/marketing/meta/ads-import` and `/api/marketing/meta/organic-import`) were already created in the API Audit phase but had no UI.
- **Fix**: Created `app/(dashboard)/marketing/meta-import/page.tsx` — a client component page with:
  - **Two tabs**: "meta ads (paid)" and "instagram organic", switching `ImportPanel` state.
  - **Info panel**: per-tab expected columns, example CSV row, destination table.
  - **Drag-and-drop upload**: file picker with size display; hidden `<input type="file">` wired via ref.
  - **Platform selector**: dropdown for organic imports (instagram/tiktok/youtube/linkedin/facebook/other).
  - **Submit**: POSTs FormData to the correct API endpoint; shows `ResultBanner` with total/inserted/skipped/failed counts and per-row errors.
  - **Error display**: inline red banner for network/HTTP errors.
  - **Nav links**: back to paid analytics and to organic analytics.

---

### Summary

| Category | Count |
|---|---|
| Pages audited | 17 |
| Pages with mock data | 0 |
| Missing pages created | 4 |
| Components updated | 1 (`MoneyTabs` — added invoices tab) |
| Pages passing with no changes | 17 |

---

## Navigation & Command Palette Audit

_Audited: 2026-04-08_

### Methodology

`components/layout/sidebar.tsx` was read in full and cross-referenced against the required nav spec (Command, Outreach, Marketing with all sub-sections, Operations, Money with all sub-sections, Reports, Settings). `components/command/command-palette.tsx` was read in full and checked for: Cmd/Ctrl+K wiring, full nav coverage, search types, quick actions, and cron triggers. `components/layout/keyboard-shortcuts.tsx` and `app/(dashboard)/layout.tsx` were read to verify palette rendering and Cmd+K event wiring.

---

### Infrastructure — Verified Correct

| Check | Status |
|---|---|
| `CommandPalette` exists at `components/command/command-palette.tsx` | ✓ |
| `CommandPalette` rendered in root dashboard layout via `KeyboardShortcuts` | ✓ (`app/(dashboard)/layout.tsx` → `KeyboardShortcuts` → `CommandPalette`) |
| Responds to Cmd/Ctrl+K | ✓ (`keyboard-shortcuts.tsx` listens for `(metaKey \| ctrlKey) && key === "k"`) |
| Responds to `?` key (outside inputs) | ✓ |
| Cmd+J → Command Center (`/command`) | ✓ |
| Cmd+N → new contact (`/crm?new=1`) | ✓ |
| Cmd+E → new email (`/outreach?new=1`) | ✓ |
| Cmd+Shift+S → new shoot | ✓ |
| Search types covered (contacts, shoots, invoices, campaigns) | ✓ (via `/api/command/search`) |
| Cron triggers for all 9 registered jobs | ✓ (listing-monitor, followup-reminder, analytics-snapshot, tour-slot-check, tax-threshold, invoice-overdue, campaign-health, shoot-today, weekly-report) |

---

### Sidebar Gaps Found and Fixed (`components/layout/sidebar.tsx`)

#### 1. Marketing — no sub-items
- **Before**: Marketing was a flat link to `/marketing` with no sub-navigation.
- **Required**: content calendar, Meta Ads, Organic Analytics, Import Meta.
- **Fix**: Converted marketing to a group with 5 sub-items:
  - `overview` → `/marketing`
  - `meta ads` → `/marketing/meta` (TrendingUp icon)
  - `organic` → `/marketing/meta/organic` (Activity icon)
  - `import meta` → `/marketing/meta-import` (FileUp icon)
  - `content calendar` → `/content` (Calendar icon)
- **Bonus**: Added `isActive` override so the marketing group highlights when `pathname.startsWith("/content")`, since content calendar lives under it.

#### 2. Content Calendar — incorrect top-level placement
- **Before**: `/content` was its own top-level nav item, isolated from marketing.
- **Fix**: Removed top-level content entry; now appears as a sub-item under Marketing (see above).

#### 3. Money — missing `/money/invoices` sub-item
- **Before**: Money sub-items were: overview, taxes, expenses, import wave. Invoices were missing.
- **Fix**: Added `invoices` → `/money/invoices` between overview and taxes (consistent with tab order in `MoneyTabs`).

#### 4. Reports — wrong href
- **Before**: Reports linked to `/reports` (root reports page).
- **Required**: Link to `/reports/weekly`.
- **Fix**: Changed href to `/reports/weekly`.

#### 5. Operations — invoices sub-item removed
- **Before**: Operations had shoots, matterport, invoices.
- **Required spec**: Operations (shoots, tours) only.
- **Fix**: Removed invoices from operations sub-items. Invoices are accessible under Money → invoices as intended.

#### 6. New icon imports
- Added `TrendingUp` and `Activity` to imports for the new marketing sub-items.

---

### Command Palette Gaps Found and Fixed (`components/command/command-palette.tsx`)

#### 1. Missing nav commands for new marketing pages
- **Before**: No nav commands for `/marketing/meta`, `/marketing/meta/organic`, `/marketing/meta-import`.
- **Fix**: Added three new entries to `NAV_COMMANDS`:
  - `nav-meta` → "Meta Ads (Payées)" → `/marketing/meta`
  - `nav-meta-organic` → "Analytics Organiques" → `/marketing/meta/organic`
  - `nav-meta-import` → "Import Meta" → `/marketing/meta-import`

#### 2. Missing nav command for `/money/invoices`
- **Before**: No command for the invoices page under the money module.
- **Fix**: Added `nav-money-invoices` → "Factures (finances)" → `/money/invoices`.

#### 3. Missing "Quick Actions" category — new
- **Before**: Command palette had no quick action commands. Spec requires: new contact, new shoot, new expense, new content item, new invoice.
- **Fix**: Added `QUICK_ACTIONS` constant with 5 entries using `?new=1` URL params (consistent pattern with existing keyboard shortcuts in `keyboard-shortcuts.tsx`):
  - "Nouveau contact" → `/crm?new=1` (UserPlus icon)
  - "Nouveau shoot" → `/operations/shoots?new=1` (Camera icon)
  - "Nouvelle dépense" → `/money/expenses?new=1` (CreditCard icon)
  - "Nouveau contenu" → `/content?new=1` (Plus icon)
  - "Nouvelle facture" → `/money/invoices?new=1` (Receipt icon)
- Quick actions are wired into `allCommands` under the "Actions rapides" category.
- Quick actions appear in the default (no-query) view alongside nav and automation commands.

#### 4. New icon imports
- Added `TrendingUp`, `Activity`, `UserPlus`, `Plus` to imports.

---

### Items Confirmed Correct (No Changes Needed)

| Item | Status |
|---|---|
| Command Center at top of sidebar (`/command`, Terminal icon, action-item badge) | ✓ |
| Outreach section (CRM `/crm` + Outreach `/outreach`) | ✓ |
| `nav-reports` → `/reports/weekly` in command palette | ✓ (was already correct) |
| `nav-cron` → `/settings/cron` in command palette | ✓ |
| Cron trigger commands for all 9 jobs | ✓ |
| Search command wired to `/api/command/search` (contacts, shoots, invoices, campaigns) | ✓ |
| Palette rendered in dashboard layout | ✓ |
| Cmd+K opens palette (even inside input fields) | ✓ |

---

### Summary

| Category | Count |
|---|---|
| Sidebar items audited | 11 (top-level) |
| Sidebar gaps fixed | 5 (marketing sub-items, content moved, money/invoices, reports href, operations cleaned) |
| Command palette nav commands added | 4 (meta, meta-organic, meta-import, money/invoices) |
| Command palette quick actions added | 5 (new contact, shoot, expense, content, invoice) |
| New icon imports (sidebar) | 2 (TrendingUp, Activity) |
| New icon imports (palette) | 4 (TrendingUp, Activity, UserPlus, Plus) |
| Items confirmed correct with no changes | 8 |

---

## Env Configuration

_Audited: 2026-04-08_

### Methodology

All `.ts` and `.tsx` files under `app/`, `lib/`, and `scripts/` were grepped for `process.env.\w+` references. Results were cross-referenced against `.env.local.example`. Missing vars were added. Early validation was then added to throw clear errors at startup rather than surfacing cryptic runtime failures.

---

### Environment Variables — Full Inventory

| Variable | Required | Location in code | Previously in example |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/cron/*.ts`, `app/api/contacts/import`, `app/api/webhooks/form-submission`, `app/api/health`, `scripts/seed.ts` | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts` | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | `lib/supabase/server.ts` (`createAdminClient`), `lib/cron/run-job.ts`, `lib/cron/index.ts`, `app/api/contacts/import`, `app/api/webhooks/form-submission`, `app/api/health`, `scripts/seed.ts` | ✓ |
| `ZOHO_SMTP_USER` | Needed for email | `lib/email.ts` | ✓ |
| `ZOHO_SMTP_PASSWORD` | Needed for email | `lib/email.ts` | ✓ (as `ZOHO_SMTP_PASSWORD`, not `ZOHO_SMTP_PASS`) |
| `NEXT_PUBLIC_APP_URL` | Recommended | Absolute URL construction in emails | ✓ |
| `CRON_SECRET` | Prod only | Protects `/api/cron/trigger/[jobName]` | ✓ |
| `ANTHROPIC_API_KEY` | Needed for AI routes | `app/api/ai/caption/route.ts`, `app/api/ai/recommend/route.ts`, `app/api/outreach/campaigns/[id]/generate/route.ts` | **Missing** — was listed as "unused" |

---

### Gap Found: `ANTHROPIC_API_KEY` Missing from Example

**Issue**: Three active API routes import and instantiate `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` at module load time:
- `/api/ai/caption` — Instagram caption generation (FR + EN)
- `/api/ai/recommend` — Content recommendation
- `/api/outreach/campaigns/[id]/generate` — Campaign copy generation

The `.env.local.example` listed `ANTHROPIC_API_KEY` as a **commented-out unused variable** with the note "No runtime AI calls". This contradicts the deployed code.

**Fix**: Added `ANTHROPIC_API_KEY=` (empty placeholder) to `.env.local.example` with a note explaining the discrepancy. The dashboard loads normally if the key is absent — only the three AI routes will 500 when called.

**Note for Luca**: The CLAUDE.md spec says "No Anthropic API — no runtime AI calls." These routes appear to have been added anyway. If you want to use them, add your Anthropic API key to `.env.local`. If you never intend to use them, consider removing the three routes (`app/api/ai/` and `app/api/outreach/campaigns/[id]/generate/route.ts`) to clean up the build.

---

### Gap Found: Zoho SMTP vars naming discrepancy

**Issue**: CLAUDE.md spec lists `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, and `ZOHO_SMTP_PASS`. The actual code in `lib/email.ts` hardcodes `host: "smtp.zoho.com"` and `port: 465`, and reads `ZOHO_SMTP_PASSWORD` (not `ZOHO_SMTP_PASS`).

**Status**: No fix required — the example already uses `ZOHO_SMTP_PASSWORD` correctly. CLAUDE.md spec is inaccurate but the implementation is correct.

---

### Early Validation — Added

**Issue**: All Supabase client files used TypeScript's non-null assertion (`!`) with no runtime check. If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, the app crashes with: `TypeError: Cannot read properties of undefined` buried inside the `@supabase/ssr` library — no indication of what went wrong.

Similarly, `lib/email.ts` created its `nodemailer` transporter at module load time with `undefined` auth credentials, failing silently until a send was attempted.

**Fixes applied**:

1. **`lib/env.ts`** (new) — Central validation module. Declares required and warn-if-missing vars. `validateEnv()` throws a descriptive multi-line error message listing each missing variable with a hint pointing to where to find it.

2. **`instrumentation.ts`** — Updated to call `validateEnv()` before `registerCronJobs()`. This runs on server startup (Node.js runtime only) and will prevent the server from starting if critical vars are absent.

3. **`lib/supabase/client.ts`** — Added a null check inside `createClient()` that throws a clear error message with instructions before passing `undefined` to `createBrowserClient`. This covers client-side rendering where `instrumentation.ts` does not run.

4. **`lib/email.ts`** — Added a null check at the top of `sendEmail()` that throws a clear error before attempting to send with missing credentials.

---

### Summary

| Category | Finding |
|---|---|
| Vars in codebase | 8 |
| Vars in example (before) | 7 |
| Vars missing from example | 1 (`ANTHROPIC_API_KEY`) |
| Naming discrepancies | 1 (CLAUDE.md vs code; code is correct) |
| Early validation added | 4 (lib/env.ts, instrumentation.ts, supabase/client.ts, email.ts) |

---

## Smoke Test Checklist

_For manual verification after `npm run dev` starts cleanly._

Use this checklist before each release or after major changes.

---

### Pre-flight

- [ ] Copy `.env.local.example` to `.env.local` (if not already done)
- [ ] Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Confirm all Supabase migrations (001–009) have been applied: `supabase db push` or via dashboard SQL editor

---

### 1. Dev server — no console errors

```bash
npm run dev
```

- [ ] Server starts without throwing an env validation error
- [ ] No red errors in terminal output (warnings about missing optional vars are OK)
- [ ] Browser console on any page shows no uncaught errors on load

---

### 2. Command Center loads (`/command`)

- [ ] Navigate to `/command`
- [ ] **Today's Actions** section renders (may be empty if no action items exist)
- [ ] **Scoreboard** section renders with stat cards (revenue, shoots, pipeline, emails) — may show zeros on a fresh DB
- [ ] No "Failed to fetch" or Supabase error banners

---

### 3. Command palette opens (`Cmd+K` / `Ctrl+K`)

- [ ] Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
- [ ] Palette opens with search input focused
- [ ] Default view shows categories: **Navigation**, **Actions rapides**, **Automatisation**
- [ ] Type "meta" → at least 3 results appear (Meta Ads, Organic, Import Meta)
- [ ] Type "contact" → "Nouveau contact" quick action appears
- [ ] Click any nav item → palette closes and navigates correctly
- [ ] Press `Esc` → palette closes

---

### 4. Wave import page renders (`/money/import-wave`)

- [ ] Navigate to `/money/import-wave`
- [ ] Upload UI renders with drag-and-drop zone
- [ ] "Import type" selector (Invoices / Expenses) is visible
- [ ] Contact selector dropdown is visible
- [ ] No Supabase errors in console

---

### 5. Meta import page renders (`/marketing/meta-import`)

- [ ] Navigate to `/marketing/meta-import`
- [ ] Two tabs visible: **meta ads (paid)** and **instagram organic**
- [ ] "Meta Ads" tab selected by default — paid ads upload zone + expected columns info panel visible
- [ ] Switch to "Instagram Organic" tab → organic upload zone + platform selector visible
- [ ] No errors on either tab

---

### 6. Cron jobs trigger manually (`/settings`)

- [ ] Navigate to `/settings` → click "Cron Jobs" or go directly to `/settings/cron`
- [ ] All 9 jobs listed: `listing-monitor`, `followup-reminder`, `analytics-snapshot`, `tour-slot-check`, `tax-threshold`, `invoice-overdue`, `campaign-health`, `shoot-today`, `weekly-report`
- [ ] Click "Run" / manual trigger on `analytics-snapshot` → response shows `{ job, summary }` without error
- [ ] Click "Run" on `invoice-overdue` → response shows summary without error
- [ ] Confirm a new row appears in `cron_logs` in the Supabase dashboard after each trigger

---

### 7. Weekly report renders (`/reports/weekly`)

- [ ] Navigate to `/reports/weekly`
- [ ] Page loads (may show zero-state if no analytics data)
- [ ] **Financial section** visible: revenue MTD, shoots completed, invoice status
- [ ] **Meta/marketing section** visible: spend by channel, cost per lead
- [ ] Week selector or "current week" label visible
- [ ] No API error banners

---

### 8. Create a test contact via command palette

- [ ] Open command palette (`Cmd+K`)
- [ ] Click "Nouveau contact" or press `Cmd+N`
- [ ] New contact form / modal opens at `/crm?new=1`
- [ ] Fill in: Name = "Test Agent", Email = "test@example.com", Agency = "Test Agency"
- [ ] Submit → contact appears in the CRM list
- [ ] Navigate to `/crm` → "Test Agent" is visible in the pipeline
- [ ] Delete the test contact afterward (Supabase dashboard or CRM delete action)

---

### 9. Upload a 1-row Wave invoice CSV (`/money/import-wave`)

Prepare a minimal CSV with this content:
```
Invoice Number,Customer Name,Invoice Date,Due Date,Invoice Status,Subtotal,Tax 1 Amount,Tax 2 Amount,Total,Amount Due
INV-SMOKE-001,Test Client,2026-04-08,2026-04-22,Sent,150.00,7.50,10.61,168.11,168.11
```

- [ ] Navigate to `/money/import-wave`
- [ ] Select type: **Invoices**
- [ ] Upload the CSV file
- [ ] Response shows `{ inserted: 1, skipped: 0, failed: 0 }`
- [ ] Navigate to `/money/invoices` → the row appears in the invoice list
- [ ] Re-upload the same CSV → response shows `{ inserted: 0, skipped: 1 }` (deduplication working)

---

### 10. Upload a 1-row Meta Ads CSV (`/marketing/meta-import`)

Prepare a minimal CSV with this content:
```
Campaign name,Day,Amount spent (CAD),Impressions,Clicks (all),Results,Reach
Smoke Test Campaign,2026-04-08,5.00,200,12,1,180
```

- [ ] Navigate to `/marketing/meta-import`
- [ ] Select tab: **meta ads (paid)**
- [ ] Upload the CSV file
- [ ] Response shows `{ inserted: 1, skipped: 0, failed: 0 }`
- [ ] Navigate to `/marketing/meta` → the campaign or spend entry is visible
- [ ] Re-upload the same CSV → response shows `{ inserted: 0, skipped: 1 }` (duplicate detection working)
