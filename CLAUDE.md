# CLAUDE.md — Spatia Growth Command Center

> Save this file as `CLAUDE.md` at the root of your project. Claude Code reads it automatically on every session.

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

| Tier   | Sq ft               | Regular | Beta (first 5 clients) |
|--------|---------------------|---------|------------------------|
| 1      | ≤1,500              | $150    | PRIVATE                |
| 2      | 1,500–2,500         | $200    | PRIVATE                |
| 3      | 2,500–3,500         | $275    | PRIVATE                |
| 4      | 3,500+              | $350    | PRIVATE                |
| Rush   | Same-day            | +$50    | +$50                   |
| Travel | >30km from Brossard | +$25    | +$25                   |

Free trial shoots: invoice at full price with 100% discount applied (anchors perceived value). Website only shows "starting at" anchor.

### Visual Identity

- **Aesthetic**: Brutalist/editorial. Lowercase typography. Concrete-heavy, moody, film-analog references (Kodak Portra 400, Ilford HP5). Asymmetric compositions.
- **Logo**: Serif "S" icon (app icon style) + "spatia" wordmark in spaced lowercase serif. Black on white, white on black.
- **Dashboard aesthetic**: The dashboard itself should reflect this identity — dark mode default, serif accent typography, clean data visualization, editorial feel. NOT generic SaaS blue. Think: if Bloomberg Terminal had a baby with a Kinfolk magazine layout.

### Positioning Principles (CRITICAL — inform all copy and outreach)

1. **Never signal inexperience.** Spatia presents as a busy, selective studio — never as "new" or "building a portfolio."
2. **Speed is the weapon.** Same-day delivery kills competitors who take 48–72h.
3. **Geographic ownership.** South Shore is home turf. Panosphere does commercial/institutional; Spatia owns the individual agent niche.
4. **Bilingual edge.** Most competitors are French-only or English-only. Spatia does both natively.
5. **Stats belong in outreach, not on the website.** The site is editorial. Data goes in cold emails and DMs.
6. **Move in silence.** Beta pricing and deals stay private. Public content projects premium and selectivity.
7. **Positioning over discounting.** Never compete on price alone.

### Competitors (for reference, not for public mention)

- EGP Photographie — generalist real estate media
- Panosphere 360 Boucherville — commercial/institutional focus
- photographieimmobiliere.com — established but not Matterport-native
- Spatia's structural advantage: lower overhead + same Matterport platform = competitive pricing without margin sacrifice.

---

## EXISTING TOOL STACK — INTEGRATE WITH THESE

| Tool                            | Purpose                             | Integration Priority                          |
|---------------------------------|-------------------------------------|-----------------------------------------------|
| **Supabase**                    | Database + Auth + Realtime          | PRIMARY — all dashboard data lives here       |
| **Zoho Mail**                   | Email (SMTP: smtp.zoho.com)         | Send/receive outreach emails                  |
| **n8n** (lucanvc.app.n8n.cloud) | Automation orchestration            | Trigger/receive webhooks, run background jobs |
| **Google Sheets**               | Current CRM (to be migrated)        | Import existing contacts, then deprecate      |
| **Wave**                        | Invoicing + bookkeeping             | Read invoice data via CSV export (no API)     |
| **Formspree**                   | Quote form intake                   | Webhook to Supabase                           |
| **Realtor.ca**                  | Agent sourcing + listing monitoring | Scraping for lead gen + sold detection        |
| **Cloudflare R2**               | Video/asset storage                 | Serve media assets                            |
| **Matterport**                  | 3D tour platform                    | Track active/archived tours, slot management  |
| **Instagram**                   | @spatia.ca                          | Content calendar + analytics tracking         |
| **Netlify**                     | Current website hosting             | May migrate dashboard here or separate VPS    |

---

## ARCHITECTURE DECISIONS

### Stack

```
Frontend:  Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui
Backend:   Next.js API routes + Supabase (Postgres + Auth + Realtime)
ORM:       Drizzle or Prisma (your choice, be consistent)
Charts:    Recharts or Tremor
Auth:      Supabase Auth (email/password, single user for now)
Hosting:   Local dev → deploy to Railway/Fly.io/VPS when ready
Automation: n8n webhooks for background jobs
Email:     Nodemailer with Zoho SMTP for sending; webhook receiver for replies
Scraping:  Cheerio + fetch for Realtor.ca (respect rate limits, no aggressive scraping)
AI:        Anthropic API (Claude) for email drafting, lead scoring, copy generation
```

### Database Schema (Supabase/Postgres)

Design these core tables. Use proper foreign keys, indexes, and RLS policies:

```
contacts          — All leads/agents (name, email, phone, agency, source, status, notes, tags, created_at, updated_at)
outreach_emails   — Every email sent (contact_id, subject, body, status, sent_at, opened_at, replied_at, campaign_id)
campaigns         — Outreach campaigns (name, type, status, template, target_criteria, stats)
shoots            — Booked/completed shoots (contact_id, address, sq_ft, tier, price, status, scheduled_at, delivered_at, matterport_url)
invoices          — Synced from Wave or manual entry (shoot_id, contact_id, amount, tax, status, paid_at)
tours             — Active Matterport tours (shoot_id, matterport_id, status, views, archived_at)
listings          — Monitored Realtor.ca listings (address, mls_number, agent_name, status, last_checked)
marketing_spend   — Ad spend tracking (channel, amount, date, campaign_name, impressions, clicks, leads_generated)
revenue_events    — Revenue attribution (source, contact_id, amount, date)
content_calendar  — Instagram/social content planning (platform, content_type, pillar, caption_fr, caption_en, media_url, scheduled_at, posted_at, engagement_metrics)
analytics_daily   — Daily aggregated metrics (date, emails_sent, emails_opened, replies, shoots_booked, revenue, ad_spend, instagram_followers, website_visits)
notes             — General notes/journal entries (content, category, created_at)
```

---

## MODULE 1: OUTREACH COMMAND CENTER

### Lead Sourcing

- **Realtor.ca scraper**: Scrape agent profiles from South Shore brokerages. Extract: name, email (from brokerage pages), phone, agency, areas served, recent listings.
- **Google Places API**: Cross-reference agent data, get reviews and ratings.
- **Manual import**: CSV upload for leads from networking, ImmoHEC contacts, etc.
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

- **CASL compliance is NON-NEGOTIABLE**: Every email must have a clear unsubscribe mechanism. Only email agents with implied consent (their contact info is publicly listed for business purposes on brokerage sites). Log consent basis for every contact.
- **Human-in-the-loop**: AI drafts emails → Luca reviews/edits → Luca clicks send. NEVER auto-send. Show a review queue with approve/edit/reject for each draft.
- **Email templates**: Store reusable templates. Variables: `{agent_name}`, `{agency}`, `{listing_address}`, `{compliment}`, `{cta}`.
- **AI drafting**: Use Claude API to generate personalized cold emails. Input: agent profile + recent listing data. Output: short, natural French email that leads with a genuine property-specific compliment. Tone: casual, human, not corporate. One follow-up maximum, 5–7 days after no reply.
- **Tracking**: Log sent/opened/replied/bounced status. Calculate open rate, reply rate, booking rate per campaign.
- **Zoho SMTP integration**: Send via lucanovac@spatia.ca. Configure Nodemailer with:
  - Host: smtp.zoho.com
  - Port: 465 (SSL)
  - Auth: email + app-specific password (stored in .env)
- **Reply detection**: Webhook or IMAP polling to detect replies and auto-update contact status.

### Outreach Analytics Dashboard

- Emails sent / opened / replied (daily, weekly, monthly)
- Reply rate by campaign, by template, by agent segment
- Pipeline conversion funnel visualization
- Best-performing email templates ranked by reply rate
- Heatmap: best days/times to send (track when opens/replies happen)
- "Leads going cold" alert: contacts in "First Email Sent" for >7 days with no reply

### Outreach Copy Guidelines (for AI drafting)

```
TONE: Short, natural, leads with a genuine property-specific compliment. 
      Avoids corporate/template feel. Québécois French by default.
      Max 4-5 sentences for cold email. Subject line under 6 words.
      
STRUCTURE:
  1. Property-specific compliment (reference a real listing detail)
  2. One-sentence value prop (speed + quality)
  3. Soft CTA (not "book a call" — more like "seriez-vous ouvert à un essai?")
  
FOLLOW-UP (5-7 days later, only ONE):
  1. Brief, friendly, reference the first email
  2. Add one new angle (seasonal timing, new testimonial, etc.)
  3. Easy out: "Si c'est pas le bon moment, aucun souci."

NEVER:
  - Mention being new/launching/building portfolio
  - Offer free publicly (beta pricing only in private DMs)
  - Use corporate language ("solutions", "leverage", "synergy")
  - Send more than one follow-up
  - CC/BCC multiple agents in one email
```

---

## MODULE 2: MARKETING & AD ANALYTICS

### Ad Spend Tracker

- Manual entry + CSV import for ad spend per channel (Meta, Google, Instagram promoted, etc.)
- Fields: date, channel, campaign_name, amount_spent, impressions, clicks, leads_attributed
- Running total: monthly spend, cost per lead, cost per booking, ROAS

### Revenue Attribution

- Connect every shoot/payment back to its lead source (cold email campaign, Instagram DM, referral, Meta ad, organic)
- Dashboard view: revenue by source (pie chart + trend line)
- LTV calculation: revenue per client over time
- Key metric: Customer Acquisition Cost by channel vs. revenue generated

### Marketing Dashboard Widgets

- Total revenue (MTD, QTD, YTD) with trend
- Ad spend vs. revenue overlay chart
- Top 3 revenue sources this month
- Instagram follower growth + engagement rate trend
- Website traffic (manual entry or Cloudflare analytics API if available)
- Content calendar view: upcoming posts with pillar tags

### Channel Optimization Recommendations

- AI-generated weekly summary: "Your best-performing channel this week was [X]. Consider shifting $[Y] from [Z] to [X] based on cost-per-lead data."
- Flag underperforming channels (cost per lead > 2x average)

---

## MODULE 3: OPERATIONS & GROWTH

### Shoot Pipeline Tracker

- Calendar view of upcoming shoots (date, time, address, agent, sq ft tier)
- Status flow: Booked → Shot → Processing → Delivered → Paid
- Auto-calculate price based on sq ft tier + rush + travel surcharges
- Delivery time tracker: time from shoot to delivery (goal: same-day for rush, <24h standard)
- Link to Matterport tour URL once delivered

### Matterport Slot Manager

- Track active tours vs. plan limit
- Flag tours linked to sold listings (from Realtor.ca monitoring)
- One-click archive recommendation: "These 3 tours are for sold properties — archive to free slots?"
- Slot utilization gauge

### Invoice & Revenue Tracker

- Manual entry or CSV import from Wave
- Revenue dashboard: daily, weekly, monthly, quarterly views
- Outstanding invoices alert
- Average time to payment
- Tax tracking: GST (5%) + QST (9.975%) totals for filing

### Content Calendar (5-Pillar System)

Spatia's Instagram content follows five pillars:

```
1. THE WORK     — Tour showcases, before/after, walkthroughs
2. THE EDGE     — Speed stats, tech shots, competitive advantages
3. THE PROCESS  — Behind-the-scenes, equipment, workflow
4. THE PROOF    — Client testimonials, results, social proof
5. THE CULTURE  — Personal brand, Brossard life, studio aesthetic
```

- Calendar grid: drag posts to dates, assign pillar tags, write captions (FR primary + EN)
- Balance indicator: ensure all 5 pillars get coverage each month
- Draft captions with AI: input pillar + topic → output bilingual caption in Spatia voice
- Post status: Draft → Scheduled → Posted → Analyzed

### Growth Metrics Overview (Home Dashboard)

The landing page when you open the app. Single glance = business health:

```
┌─────────────────────────────────────────────────────────┐
│  SPATIA GROWTH COMMAND CENTER            [dark mode on] │
├──────────────┬──────────────┬──────────────┬────────────┤
│  Revenue MTD │  Shoots MTD  │  Pipeline    │  Slot Usage│
│  $X,XXX      │  XX          │  XX leads    │  X/XX      │
│  ▲ XX% vs LM │  ▲ XX% vs LM│  XX% conv.   │  XX% full  │
├──────────────┴──────────────┴──────────────┴────────────┤
│                                                         │
│  [Revenue vs Spend chart — 30 day trend]                │
│                                                         │
├─────────────────────────┬───────────────────────────────┤
│  OUTREACH PIPELINE      │  UPCOMING SHOOTS              │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐   │  Today: 2 shoots              │
│  │12│→│ 8│→│ 3│→│ 1│   │  Tomorrow: 1 shoot            │
│  └──┘ └──┘ └──┘ └──┘   │  This week: 5 shoots          │
│  New  Sent Reply Booked │                               │
├─────────────────────────┴───────────────────────────────┤
│  ACTIONS NEEDED                                         │
│  ⚠ 3 emails awaiting review                            │
│  ⚠ 1 invoice overdue (7 days)                          │
│  ⚠ 2 Matterport tours on sold listings — archive?      │
│  📅 No content scheduled for Thursday                   │
└─────────────────────────────────────────────────────────┘
```

---

## MODULE 4: AI ASSISTANT (EMBEDDED)

### Built-in Claude Chat

An embedded chat panel (sidebar or modal) powered by Claude API that has full context of the dashboard data. Use cases:

- "Draft a cold email for [agent name]" — pulls agent data from CRM, generates personalized email
- "What's my best-performing outreach campaign?" — queries analytics and responds
- "Write an Instagram caption for a shoot at [address]" — generates bilingual caption in Spatia voice
- "How should I allocate my $200 ad budget this month?" — analyzes channel performance and recommends

### Weekly Growth Report (Auto-generated)

Every Sunday night, generate a Markdown report:

- Revenue summary (week + MTD)
- Outreach performance (emails sent, replies, bookings)
- Content posted + engagement
- Ad spend + ROAS
- Top 3 wins this week
- Top 3 priorities for next week
- AI-suggested actions

---

## TECHNICAL REQUIREMENTS

### Security

- All API keys in `.env.local` (NEVER commit to git)
- Supabase RLS policies on all tables
- Single-user auth (Luca only) — no public registration
- Rate limit all API routes
- Sanitize all inputs (especially scraper data)

### Performance

- Server-side rendering for dashboard pages
- Optimistic UI updates for CRM actions
- Debounced search
- Paginated tables (50 rows default)
- Lazy-load charts

### Code Quality

- TypeScript everywhere (strict mode)
- Consistent file structure: `/app`, `/components`, `/lib`, `/hooks`, `/types`
- Reusable chart components
- Proper error boundaries
- Loading skeletons for async data
- Toast notifications for actions (success/error)

### Development Workflow

1. Start with database schema (Supabase migrations)
2. Build API routes + data layer
3. Build UI module by module (Home → CRM → Outreach → Marketing → Operations)
4. Add AI features last (email drafting, assistant, weekly report)
5. Polish: animations, responsive design, dark mode

---

## COMPLIANCE REMINDERS

- **CASL**: Implied consent only for B2B outreach to publicly listed agents. Include unsubscribe in every email. Log consent basis. One follow-up max.
- **Quebec Bill 96**: All client-facing communications French-first. Dashboard UI can be English (internal tool).
- **GST/QST**: Not collecting yet (under $30K threshold). Track revenue toward threshold. Alert when approaching $30K.
- **Matterport TOS**: Tours are visual experiences, not measurement tools. Disclaimer on all deliverables.
- **Privacy**: Never expose agent personal data publicly. CRM data is internal only.

---

## WHAT SUCCESS LOOKS LIKE

In 30 days, this dashboard should:

1. Replace Google Sheets as the CRM
2. Draft personalized outreach emails that Luca reviews and sends in <2 minutes each
3. Show a clear picture of which channels drive revenue
4. Track every shoot from booking to payment
5. Manage Matterport slots without manual checking
6. Plan content across all 5 pillars with bilingual captions

In 90 days:

1. Have enough data to optimize ad spend allocation automatically
2. Generate weekly growth reports that actually inform decisions
3. Serve as the single source of truth for all Spatia operations

---

## REMEMBER

Every hour Luca spends building features is an hour not spent shooting tours and closing clients. **Build fast, ship ugly, iterate.** The dashboard doesn't need to be perfect on day one — it needs to be useful on day one. Start with the CRM + outreach module (that's where revenue comes from), then layer everything else.

The infrastructure phase is OVER. This tool exists to SELL.
