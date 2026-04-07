# CLAUDE.md — Spatia Growth Command Center

> **Save this file as `CLAUDE.md` at the root of your project. Claude Code reads it automatically on every session.**

---

## PROJECT IDENTITY

You are building **Spatia Growth Command Center** — a self-hosted Next.js web dashboard that serves as the central nervous system for **Spatia** (spatia.ca), a 3D virtual tour studio targeting real estate agents on Montreal's South Shore and Greater Montreal area.

This is not a toy project. This is a revenue-generating operations platform for a real business. Every feature must be production-grade, reliable, and designed to save the founder (Luca) time while generating more revenue.

---

## BRAND IDENTITY — MEMORIZE THIS

### Company
- **Legal name**: Studio Spatia (sole proprietorship, NEQ 2281954034)
- **Trade name**: Spatia
- **Domain**: spatia.ca
- **Instagram**: @spatia.ca
- **Email**: lucanovac@spatia.ca (Zoho Mail)
- **Location**: Brossard, Quebec, Canada
- **Service area**: Montreal South Shore + Greater Montreal
- **Language**: Bilingual French/English. French-first (Quebec Bill 96 compliance). All outreach in French unless agent is clearly anglophone.

### Core Service
Matterport-processed 3D virtual tours for real estate listings. Shot with Ricoh Theta Z1. Same-day delivery is the key differentiator. Future upsells: CubiCasa ANSI floor plans, Gaussian splatting premium tours.

### Pricing (CONFIDENTIAL — never expose full grid publicly)
| Tier | Sq ft | Regular | Beta (first 5 clients) |
|------|--------|---------|----------------------|
| 1 | ≤1,500 | $150 | PRIVATE |
| 2 | 1,500–2,500 | $200 | PRIVATE |
| 3 | 2,500–3,500 | $275 | PRIVATE |
| 4 | 3,500+ | $350 | PRIVATE |
| Rush | Same-day | +$50 | +$50 |
| Travel | >30km from Brossard | +$25 | +$25 |

Free trial shoots: invoice at full price with 100% discount applied (anchors perceived value). Website only shows "starting at" anchor.

### Visual Identity
- **Aesthetic**: Brutalist/editorial. Lowercase typography. Concrete-heavy, moody, film-analog references (Kodak Portra 400, Ilford HP5). Asymmetric compositions.
- **Logo**: Serif "S" icon (app icon style) + "spatia" wordmark in spaced lowercase serif. Black on white, white on black.
- **Dashboard aesthetic**: Dark mode default, serif accent typography, clean data visualization, editorial feel. NOT generic SaaS blue. Think: Bloomberg Terminal meets Kinfolk magazine.

### Positioning Principles (CRITICAL — inform all copy and outreach)
1. **Never signal inexperience.** Spatia presents as a busy, selective studio — never as "new" or "building a portfolio."
2. **Speed is the weapon.** Same-day delivery kills competitors who take 48–72h.
3. **Geographic ownership.** South Shore is home turf. Panosphere does commercial/institutional; Spatia owns the individual agent niche.
4. **Bilingual edge.** Most competitors are French-only or English-only. Spatia does both natively.
5. **Stats belong in outreach, not on the website.** The site is editorial. Data goes in cold emails and DMs.
6. **Move in silence.** Beta pricing and deals stay private. Public content projects premium and selectivity.
7. **Positioning over discounting.** Never compete on price alone.

### Competitors (for reference, not for public mention)
- **EGP Photographie** — generalist real estate media
- **Panosphere 360 Boucherville** — commercial/institutional focus
- **photographieimmobiliere.com** — established but not Matterport-native
- Spatia's structural advantage: lower overhead + same Matterport platform = competitive pricing without margin sacrifice.

---

## EXISTING TOOL STACK — INTEGRATE WITH THESE

| Tool | Purpose | Integration Priority |
|------|---------|---------------------|
| **Supabase** | Database + Auth + Realtime | PRIMARY — all dashboard data lives here |
| **Zoho Mail** | Email (SMTP: smtp.zoho.com) | Send outreach emails via Nodemailer |
| **Google Sheets** | Current CRM (to be migrated) | Import existing contacts, then deprecate |
| **Wave** | Invoicing + bookkeeping | Read invoice data via CSV export (no API) |
| **Formspree** | Quote form intake | Webhook to Supabase |
| **Realtor.ca** | Agent sourcing + listing monitoring | Scraping for lead gen + sold detection |
| **Cloudflare R2** | Video/asset storage | Serve media assets |
| **Matterport** | 3D tour platform | Track active/archived tours, slot management |
| **Instagram** | @spatia.ca | Content calendar + analytics tracking |

### What we are NOT using
- **No n8n** — all automation is built-in via Next.js API routes + node-cron
- **No Anthropic API** — no runtime AI calls. Email drafting, captions, analysis are done manually in Claude.ai by Luca. The dashboard is a pure data + operations tool.
- **No external automation platforms** — everything runs inside the Next.js app

---

## ARCHITECTURE

### Stack
```
Frontend:  Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui
Backend:   Next.js API routes + Supabase (Postgres + Auth + Realtime)
ORM:       Drizzle or Prisma (be consistent)
Charts:    Recharts or Tremor
Auth:      Supabase Auth (email/password, single user)
Hosting:   Local dev → deploy to Railway/Fly.io/VPS when ready
Email:     Nodemailer with Zoho SMTP
Scraping:  Cheerio + fetch for Realtor.ca (respect rate limits)
Scheduling: node-cron for all background jobs (runs while server is up)
```

### Built-in Automation (replaces n8n entirely)
All automation lives as Next.js API routes + node-cron jobs in `/lib/cron/`:

```
/lib/cron/index.ts              — Registers all cron jobs on server start
/lib/cron/listing-monitor.ts    — Daily 2am: check if listings tied to active tours are sold
/lib/cron/followup-reminder.ts  — Daily 9am: flag contacts due for follow-up
/lib/cron/analytics-snapshot.ts — Daily 11:59pm: aggregate daily metrics into analytics_daily
/lib/cron/tour-slot-check.ts    — Daily 6am: count active Matterport tours vs plan limit
/lib/cron/tax-threshold.ts      — Weekly Monday 8am: check cumulative revenue vs $30K threshold
/lib/cron/invoice-overdue.ts    — Daily 8am: find overdue unpaid invoices

/api/webhooks/form-submission    — POST: intake from Formspree quote form
/api/cron/trigger/[job]          — GET (auth required): manually trigger any cron job
/api/contacts/import             — POST: CSV upload, parse, deduplicate, insert
```

### Database Schema (Supabase/Postgres)
Core tables with proper foreign keys, indexes, and RLS policies:

```
contacts          — All leads/agents (name, email, phone, agency, source, status, stage, notes, tags, consent_basis, unsubscribed, created_at, updated_at)
outreach_emails   — Every email sent (contact_id, subject, body, status, sent_at, opened_at, replied_at, campaign_id)
campaigns         — Outreach campaigns (name, type, status, template_id, target_criteria, stats_cache)
email_templates   — Reusable templates with variables (name, subject_template, body_template, language, variables_schema)
shoots            — Booked/completed shoots (contact_id, address, sq_ft, tier, price, rush, travel_surcharge, status, scheduled_at, delivered_at, matterport_url)
invoices          — Synced from Wave or manual (shoot_id, contact_id, amount, gst, qst, total, status, due_at, paid_at)
tours             — Active Matterport tours (shoot_id, matterport_id, listing_url, status, views, archived_at)
listings          — Monitored Realtor.ca listings (address, mls_number, agent_name, contact_id, status, last_checked, sold_detected_at)
marketing_spend   — Ad spend tracking (channel, amount, date, campaign_name, impressions, clicks, leads_generated)
revenue_events    — Revenue attribution (source_channel, contact_id, shoot_id, amount, date)
content_calendar  — Social content planning (platform, content_type, pillar, caption_fr, caption_en, media_url, scheduled_at, posted_at, engagement_metrics)
analytics_daily   — Daily aggregated metrics (date, emails_sent, emails_opened, replies, shoots_booked, shoots_completed, revenue, ad_spend, instagram_followers, website_visits)
notes             — General notes/journal (content, category, created_at)
cron_logs         — Job run history (job_name, status, result_summary, ran_at, duration_ms)
settings          — Key-value config store (matterport_slot_limit, monthly_revenue_goal, weekly_outreach_target, etc.)
weekly_reports    — Stored weekly report snapshots (week_number, year, data_json, created_at)
```

---

## MODULE 1: OUTREACH COMMAND CENTER

### Lead Sourcing
- **Realtor.ca scraper**: Scrape agent profiles from South Shore brokerages. Extract: name, email, phone, agency, areas served, recent listings.
- **Manual import**: CSV upload for leads from networking, open houses, etc.
- **Deduplication**: Match on email + name fuzzy match. Never create duplicate contacts.

### CRM Pipeline
Visual Kanban board with stages:
```
New Lead → Researched → First Email Sent → Follow-up Sent → Replied → Meeting Booked → Trial Shoot → Paying Client → Churned
```
- Drag-and-drop between stages
- Click any contact to see full history (emails, notes, shoots, invoices)
- Bulk actions: tag, move stage, export
- Search + filter by: stage, agency, area, tags, date range

### Email Outreach Engine
- **CASL compliance is NON-NEGOTIABLE**: Unsubscribe in every email. Implied consent only (publicly listed business contacts). Log consent basis. One follow-up max.
- **Human-in-the-loop**: Luca writes/edits using templates + variable substitution. NO runtime AI. Luca drafts in Claude.ai separately, pastes into templates.
- **Email templates**: Variables: `{agent_name}`, `{agency}`, `{listing_address}`, `{compliment}`, `{cta}`. Quick-fill UI: select template → select contact → fill variables → preview → send.
- **Template library** (pre-load):
  - Cold outreach (French, casual, property-specific compliment lead)
  - Follow-up (5–7 days, brief, one new angle, easy out)
  - Post-shoot delivery (Matterport link + invoice)
  - Thank you / referral ask
- **Tracking**: Log sent/opened/replied/bounced per email.
- **Zoho SMTP**: Nodemailer — Host: smtp.zoho.com, Port: 465 (SSL)

### Outreach Analytics
- Emails sent / opened / replied (daily, weekly, monthly)
- Reply rate by campaign and template
- Pipeline conversion funnel
- Best templates by reply rate
- Send time heatmap
- "Going cold" alerts

### Outreach Copy Guidelines (for Luca when drafting in Claude.ai)
```
TONE: Short, natural, property-specific compliment lead. Québécois French.
      Max 4-5 sentences. Subject under 6 words.

STRUCTURE:
  1. Property-specific compliment (real listing detail)
  2. One-sentence value prop (speed + quality)
  3. Soft CTA ("seriez-vous ouvert à un essai?")

FOLLOW-UP (5-7 days, ONE only):
  1. Brief, reference first email
  2. One new angle
  3. Easy out: "Si c'est pas le bon moment, aucun souci."

NEVER: mention being new, offer free publicly, corporate language, >1 follow-up, CC/BCC
```

---

## MODULE 2: MARKETING & AD ANALYTICS

### Ad Spend Tracker
- Manual entry + CSV import per channel (Meta, Google, Instagram promoted)
- Running totals: monthly spend, cost per lead, cost per booking, ROAS

### Revenue Attribution
- Every shoot/payment linked to lead source
- Revenue by source: pie chart + trend line
- LTV per client over time
- CAC by channel vs. revenue generated

### Marketing Widgets
- Revenue MTD/QTD/YTD with trend
- Ad spend vs. revenue overlay
- Top 3 revenue sources
- Instagram follower growth + engagement (manual entry)
- Channel health cards: green/yellow/red based on cost per lead

---

## MODULE 3: OPERATIONS & GROWTH

### Shoot Pipeline
- Calendar + list view, status: Booked → Shot → Processing → Delivered → Paid
- Auto-price from sq ft tier + surcharges
- Delivery time tracking
- Matterport URL linking

### Matterport Slot Manager
- Active vs. limit gauge
- Sold listing flags from cron
- Archive recommendations

### Invoices & Revenue
- Manual + Wave CSV import
- Outstanding/overdue alerts
- Tax tracking: GST + QST running totals
- $30K threshold progress bar

### Content Calendar (5 Pillars)
- THE WORK / THE EDGE / THE PROCESS / THE PROOF / THE CULTURE
- Calendar grid with pillar tags
- FR + EN caption fields
- Balance indicator across pillars
- Post status + engagement tracking

### Home Dashboard
Single-glance business health: revenue, shoots, pipeline, slot usage, revenue vs spend trend, outreach funnel, upcoming shoots, action items/alerts, tax threshold.

---

## MODULE 4: AUTOMATION ENGINE (BUILT-IN)

### Cron Jobs (node-cron, registered on server start)

| Job | Schedule | Action |
|-----|----------|--------|
| `listing-monitor` | Daily 2:00 AM | Check listing URLs for 3xx redirect (Centris sold signal) or "vendu" keyword. Mark sold, flag tour for archive. |
| `followup-reminder` | Daily 9:00 AM | Contacts in "First Email Sent" with no reply after 7+ days → flag for follow-up. |
| `analytics-snapshot` | Daily 11:59 PM | Aggregate day's emails, replies, shoots, revenue, spend → insert analytics_daily row. |
| `tour-slot-check` | Daily 6:00 AM | Count active tours vs limit. Alert if >80%. |
| `tax-threshold` | Monday 8:00 AM | Sum YTD revenue. Alert if approaching $30K. |
| `invoice-overdue` | Daily 8:00 AM | Find unpaid invoices past due date. Create alerts. |

### Cron Infrastructure
```typescript
// /lib/cron/index.ts — register on server start (instrumentation.ts or custom server)
import cron from 'node-cron';

export function registerCronJobs() {
  cron.schedule('0 2 * * *', runListingMonitor);
  cron.schedule('0 9 * * *', runFollowupReminder);
  cron.schedule('59 23 * * *', runAnalyticsSnapshot);
  cron.schedule('0 6 * * *', runTourSlotCheck);
  cron.schedule('0 8 * * 1', runTaxThreshold);
  cron.schedule('0 8 * * *', runInvoiceOverdue);
}
```

### Cron Logging
Every run → `cron_logs` table (job_name, status, result_summary, ran_at, duration_ms). Dashboard `/settings/cron`: recent runs, success/fail, manual trigger buttons.

### Listing Sold Detection
```
1. Fetch listing_url with redirect: 'manual'
2. 3xx → sold (Centris redirects sold listings to "propriétés similaires")
3. 200 → check body for "vendu" keyword (secondary signal)
4. Sold → update listing status, flag tour for archiving
5. Rate limit: 1 request per 2 seconds, rotate user-agent
```

### Webhook Endpoints
```
POST /api/webhooks/form-submission  — Formspree intake → create contact + note
GET  /api/cron/trigger/[jobName]    — Manual trigger (auth required)
POST /api/contacts/import           — CSV upload, parse, dedupe, insert
```

---

## MODULE 5: WEEKLY GROWTH REPORT (DATA-DRIVEN, NO AI)

### `/reports/weekly` — auto-generated Monday from analytics_daily

1. **Revenue**: week total vs last week, MTD, progress toward goal
2. **Outreach**: emails sent/opened/replied, reply rate trend, pipeline snapshot
3. **Shoots**: completed, avg delivery time, slot usage
4. **Marketing**: spend by channel, cost per lead, best/worst channel
5. **Content**: posts published, pillar distribution, engagement totals
6. **Alerts recap**: overdue invoices, sold listings, tax threshold, cold contacts

API route: `/api/reports/weekly?week=YYYY-WW` → structured JSON. Stored in `weekly_reports` table. Clean, printable report page.

---

## MODULE 6: SETTINGS

1. **Profile** — Business info, logo
2. **Pricing** — Editable tiers (used by shoot price calculator)
3. **Email** — SMTP test, default signature, unsubscribe URL
4. **Matterport** — Slot limit config
5. **Goals** — Monthly revenue target, weekly outreach target, posting frequency
6. **Cron Jobs** — Status, last run, manual triggers, enable/disable
7. **Export** — CSV export of all data
8. **Danger Zone** — Reset demo data, purge old logs

---

## TECHNICAL REQUIREMENTS

### Security
- `.env.local` for all secrets (NEVER commit)
- Supabase RLS on all tables
- Single-user auth, no public registration
- Rate limit API routes
- Sanitize scraper data
- Auth required on cron trigger endpoints

### Performance
- SSR for dashboard pages
- Optimistic UI for CRM actions
- Debounced search, paginated tables (50 rows)
- Lazy-load charts, loading skeletons

### Code Quality
- TypeScript strict mode
- Structure: `/app`, `/components`, `/lib`, `/hooks`, `/types`, `/lib/cron`
- Reusable chart components
- Error boundaries, toast notifications

---

## COMPLIANCE

- **CASL**: Implied consent, unsubscribe in every email, consent logged, one follow-up max
- **Bill 96**: Client-facing = French-first. Dashboard = English OK (internal)
- **GST/QST**: Track toward $30K threshold, alert when close
- **Matterport**: Measurement disclaimer on deliverables
- **Privacy**: CRM data internal only, never exposed publicly
- **Realtor.ca**: Rate limit scraping, don't hammer

---

## REMEMBER

Build fast, ship ugly, iterate. No AI API costs, no external automation tools. CRM + outreach first (that's where revenue lives), then layer everything else. The infrastructure phase is OVER. This tool exists to SELL.