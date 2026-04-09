# CLAUDE.md — Spatia Growth Command Center

## PROJECT IDENTITY
**Spatia Growth Command Center** — self-hosted Next.js operations dashboard for Spatia (spatia.ca), a 3D virtual tour studio targeting Montreal South Shore real estate agents.

**Stack**: Next.js 16 (App Router) · TypeScript strict · Tailwind · shadcn/ui · Supabase (Postgres + Auth) · Recharts · node-cron · Nodemailer/Zoho SMTP

**No AI API at runtime. No n8n. No external automation tools.** All automation is built-in via API routes + node-cron.

---

## BUSINESS CONTEXT (keep in mind for all copy/logic)

- **Founder**: Luca — lucanovac@spatia.ca · Brossard QC · @spatia.ca
- **Service**: Matterport 3D virtual tours, Ricoh Theta Z1, same-day delivery is the key differentiator
- **Pricing**: Tier 1 ≤1500sqft $150 · Tier 2 1500–2500 $200 · Tier 3 2500–3500 $275 · Tier 4 3500+ $350 · Rush +$50 · Travel >30km +$25
- **Compliance**: CASL (implied consent, unsubscribe in every email, 1 follow-up max) · Quebec Bill 96 (French-first) · GST 5% + QST 9.975% · $30K threshold alert
- **Dashboard aesthetic**: Dark mode, brutalist/editorial, lowercase labels, serif headings — NOT generic SaaS blue

---

## WHAT IS FULLY BUILT (do not re-plan these)

### Pages & Routes
| Route | What it does |
|-------|-------------|
| `/` | Home dashboard: revenue MTD (from invoices), shoots, pipeline funnel, Matterport slots (from settings table), alerts |
| `/command` | Command center: scoreboard, action items, activity feed, weekly outreach target progress bar |
| `/crm` | Kanban board (9 stages). Contact drawer: edit, email history, compose email via templates, add notes |
| `/crm/import` | CSV import with deduplication |
| `/outreach` | Email queue (pending_review emails) |
| `/outreach/campaigns` | Campaign CRUD + bulk email draft generation |
| `/outreach/templates` | Email template CRUD — view/create/edit/delete templates with variable detection |
| `/outreach/analytics` | Time series + campaign stats + funnel |
| `/marketing` | Ad spend overview, channel KPIs, revenue by source pie |
| `/marketing/meta` | Meta ads detail + history |
| `/marketing/meta/organic` | Organic social metrics |
| `/marketing/meta-import` | CSV import for Meta ads |
| `/content` | 5-pillar Instagram content calendar (the_work/edge/process/proof/culture). Engagement metrics on analyzed posts. FR+EN captions. |
| `/operations/shoots` | Shoots list/filter, status advancement (booked→shot→processing→delivered→paid), "create invoice" button on delivered shoots, Matterport URL field |
| `/operations/tours` | Matterport slot gauge (limit from settings), archive, add tour with optional Realtor.ca listing URL |
| `/operations/invoices` | Invoice CRUD with GST+QST auto-calc |
| `/money` | Revenue overview (MTD/QTD/YTD), charts, net profit, recent invoices |
| `/money/invoices` | Full invoice management |
| `/money/taxes` | Tax summary, YTD GST/QST, snapshots |
| `/money/expenses` | Expense tracking with categories |
| `/money/import-wave` | Wave CSV import (invoices + expenses) with review workflow |
| `/notes` | Standalone journal — categories: general/crm/strategy/ops/finance/ideas |
| `/reports` | Weekly report list |
| `/reports/weekly` | Live + stored weekly reports (revenue, outreach, shoots, marketing, content, alerts) |
| `/settings` | Settings index |
| `/settings/cron` | Cron job status, last run, manual triggers, enable/disable |
| `/settings/email` | Zoho SMTP config display + test send button |
| `/settings/goals` | Edit monthly_revenue_goal, weekly_outreach_target, matterport_slot_limit, posting_frequency_per_week (all saved to `settings` table) |
| `/settings/export` | CSV export (11 tables) + danger zone (purge cron logs, purge dismissed alerts) |
| `/tools/scraper` | Realtor.ca agent scraper → import to contacts |

### API Routes
```
GET/PATCH  /api/settings                    — settings table key-value store
POST       /api/settings/email/test         — Zoho SMTP test send
GET/DELETE /api/settings/export             — CSV export + purge actions
GET/POST   /api/outreach/templates          — email template CRUD
GET/PATCH/DELETE /api/outreach/templates/[id]
GET/POST   /api/outreach/emails             — email queue
GET/PATCH/DELETE /api/outreach/emails/[id]
POST       /api/outreach/emails/[id]/send   — send via Zoho SMTP
GET/POST   /api/outreach/campaigns
GET/PATCH/DELETE /api/outreach/campaigns/[id]
POST       /api/outreach/campaigns/[id]/generate — bulk draft creation
GET        /api/outreach/analytics
GET/POST   /api/contacts                    — list + create
GET/PATCH  /api/contacts/[id]              — detail + update (includes emails + notes)
GET        /api/contacts/search
POST       /api/contacts/import             — CSV upload
GET/POST   /api/shoots
GET/PATCH/DELETE /api/shoots/[id]
GET/POST/PATCH /api/tours
GET/POST   /api/invoices
PATCH      /api/invoices                    — marking paid auto-sets paid_at
GET/POST   /api/money/expenses
GET/PATCH/DELETE /api/money/expenses/[id]
GET/POST   /api/money/import-wave
GET        /api/money/import-wave/[batchId]
PATCH      /api/money/import-wave/[batchId]/rows/[rowId]
GET/POST   /api/content                    — content_calendar CRUD
DELETE     /api/content
GET/POST   /api/marketing-spend
GET/POST   /api/analytics                  — analytics_daily manual entry (Instagram followers, website visits)
GET/POST   /api/listings                   — listing monitoring records
GET/POST/DELETE /api/notes                 — standalone notes
GET        /api/revenue-by-source          — auto-calculated from invoices+contacts.source
GET        /api/dashboard/trend
GET        /api/calendar/events
GET        /api/calendar/feed.ics
GET/POST   /api/command/action-items
PATCH      /api/command/action-items/[id]
GET        /api/command/activity-feed
POST       /api/command/log
GET        /api/command/scoreboard
GET        /api/command/search
GET        /api/cron/status
PATCH      /api/cron/toggle
POST       /api/cron/trigger/[jobName]
GET/POST   /api/reports/weekly
GET/POST   /api/scraper/realtor-ca
POST       /api/scraper/import
POST       /api/webhooks/form-submission    — Formspree intake
GET        /api/health
```

### Cron Jobs (`/lib/cron/`)
All registered in `instrumentation.ts` on server start via `node-cron`.
| Job | Schedule | What it does |
|-----|----------|-------------|
| `listing-monitor` | Daily 2am | Check Realtor.ca listing URLs for sold signal |
| `followup-reminder` | Daily 9am | Flag contacts in first_email_sent >7 days → `followup_due` tag |
| `analytics-snapshot` | Daily 11:59pm | Aggregate day metrics → analytics_daily |
| `tour-slot-check` | Daily 6am | Count active tours vs limit from settings, create action items |
| `tax-threshold` | Monday 8am | Sum YTD revenue vs $30K threshold |
| `invoice-overdue` | Daily 8am | Flag unpaid invoices past due_at |
| `weekly-report` | Monday 7am | Generate weekly_reports snapshot |
| `campaign-health` | ? | Campaign health checks |
| `shoot-today` | ? | Same-day shoot reminders |

---

## CRITICAL DATA FLOWS (do not break these)

**Revenue tracking**: Both home dashboard AND money page read from `invoices` (status=`paid`, field=`total`). Do NOT use `revenue_events` for revenue display — that table is for manual marketing attribution only.

**Revenue by source**: `/api/revenue-by-source` auto-calculates from paid invoices + `contacts.source` field. Supplements with manual `revenue_events` if any exist.

**Matterport slot limit**: Stored as `settings` key `matterport_slot_limit`. Read by: home dashboard, `/operations/tours` (ToursManager component), cron `tour-slot-check`, command scoreboard. If you need it, fetch `/api/settings`.

**Settings table keys**: `matterport_slot_limit` (default 25) · `monthly_revenue_goal` (default 3000) · `weekly_outreach_target` (default 20) · `posting_frequency_per_week` (default 3) · `cron_*_enabled` flags.

**Email sending**: All outreach emails go through Nodemailer → Zoho SMTP (smtp.zoho.com:465). `ZOHO_SMTP_USER` and `ZOHO_SMTP_PASSWORD` must be in `.env.local`. CASL unsubscribe line is auto-appended in `lib/email.ts`. Emails are created as `status: "pending_review"` drafts and sent from the outreach queue.

**Email templates**: Stored in `email_templates` table. Variables use `{variable_name}` syntax. The contact drawer compose flow: pick template → auto-fill `{agent_name}` and `{agency}` from contact → user fills remaining vars → creates `pending_review` draft via `POST /api/outreach/emails`.

---

## KEY FILE LOCATIONS

```
app/(dashboard)/                — all dashboard pages
app/api/                        — all API routes
components/layout/sidebar.tsx   — nav with all routes
components/crm/contact-drawer.tsx — contact detail + compose email
components/operations/shoots-list.tsx — shoots with "create invoice" button
components/operations/tours-manager.tsx — reads slot limit from settings
components/content/content-calendar.tsx — engagement metrics on analyzed posts
components/marketing/marketing-dashboard.tsx — includes Instagram widget
lib/cron/                       — all cron job implementations
lib/email.ts                    — Nodemailer/Zoho transporter + CASL line
lib/pricing.ts                  — calculateShootPrice(), calculateTax(), formatCurrency()
lib/supabase/client.ts          — browser Supabase client
lib/supabase/server.ts          — server Supabase client (async createClient())
lib/alerts.ts                   — getActiveAlerts() for home dashboard
lib/action-items.ts             — upsertActionItem() used by cron jobs
types/database.ts               — Contact, OutreachEmail, Campaign, PIPELINE_STAGES
types/index.ts                  — ShootStatus, ContentPillar, ContentStatus, etc.
supabase/migrations/            — 009 migrations, all applied to Supabase
```

---

## DATABASE SCHEMA (key tables)

```
contacts          — id, name, email, phone, agency, areas_served[], source, status, notes, tags[], consent_basis, unsubscribed
outreach_emails   — id, contact_id, campaign_id, subject, body, status, is_followup, sent_at, opened_at, replied_at
email_templates   — id, name, subject_template, body_template, language, variables_schema[]
campaigns         — id, name, type, status, template, target_criteria, stats
shoots            — id, contact_id, address, sq_ft, tier, base_price, rush_surcharge, travel_surcharge, total_price, status, scheduled_at, delivered_at, paid_at, matterport_url
invoices          — id, shoot_id, contact_id, wave_invoice_id, amount, discount, subtotal, gst, qst, total, status, due_at, paid_at
tours             — id, shoot_id, matterport_id, title, status, views, listing_id, archived_at
listings          — id, address, mls_number, agent_name, contact_id, realtor_url, price, status, last_checked
content_calendar  — id, platform, content_type, pillar, caption_fr, caption_en, media_url, scheduled_at, posted_at, status, engagement_metrics(jsonb)
marketing_spend   — id, date, channel, campaign_name, amount_spent, impressions, clicks, leads_generated
revenue_events    — id, source, contact_id, shoot_id, amount, date (manual attribution only)
analytics_daily   — id, date(unique), emails_sent, emails_opened, replies, shoots_booked, revenue, ad_spend, instagram_followers, website_visits
notes             — id, content, category, contact_id, created_at
settings          — key(PK), value, updated_at
cron_logs         — id, job_name, status, result_summary, ran_at, duration_ms
action_items      — id, type, severity, title, description, related_entity_type, related_entity_id, related_url, is_resolved, is_dismissed, expires_at, source, data
weekly_reports    — id, week_number, year, data_json, created_at
expenses          — id, date, amount, gst_paid, qst_paid, category, description, vendor
```

**Contact statuses** (pipeline stages): `new_lead → researched → first_email_sent → followup_sent → replied → meeting_booked → trial_shoot → paying_client → churned`

**Shoot statuses**: `booked → shot → processing → delivered → paid`

**Content statuses**: `draft → scheduled → posted → analyzed`

---

## ENV VARS REQUIRED

```
NEXT_PUBLIC_SUPABASE_URL          — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     — Supabase anon key
SUPABASE_SERVICE_ROLE_KEY         — Supabase service role key (server-only)
ZOHO_SMTP_USER                    — Zoho email address (optional — email sending disabled without it)
ZOHO_SMTP_PASSWORD                — Zoho app-specific password
```

---

## CODING RULES

- TypeScript strict — no `any` unless unavoidable and commented
- Server components fetch data directly via `createClient()` from `lib/supabase/server`
- Client components use `fetch("/api/...")` — never import server-side Supabase in client components
- shadcn/ui for all form controls, dialogs, sheets
- `spatia-label` class for uppercase tracking labels throughout
- `font-heading` class for large numbers/titles
- Toast notifications via `sonner` — import `toast` from `"sonner"`
- All currency via `formatCurrency()` from `lib/pricing`
- Paginated tables: 50–100 rows max, `.limit()` on queries
- RLS enabled on all tables — use service role key in cron jobs (`getSupabaseAdmin()`)
- CASL: every outreach email gets `UNSUBSCRIBE_LINE` appended in `lib/email.ts`
- No external automation platforms — everything is Next.js API routes + node-cron
