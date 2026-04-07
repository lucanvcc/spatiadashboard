# Spatia Growth Command Center

A self-hosted operations dashboard for [Studio Spatia](https://spatia.ca), a 3D virtual tour studio on Montreal's South Shore. Built to replace a Google Sheets CRM and centralize outreach, shoot operations, marketing analytics, and content planning into one tool — designed for a solo founder who bills by the hour and needs every minute to count.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS + shadcn/ui |
| Database | Supabase (Postgres + Auth + Row Level Security) |
| Charts | Recharts |
| Email | Nodemailer + Zoho SMTP |
| Scraping | Cheerio + fetch (Realtor.ca agent profiles) |
| Scheduling | node-cron (built-in, no external tools) |
| Hosting | Docker / Railway / Fly.io (self-hosted) |

---

## Modules

| Module | Description |
|--------|-------------|
| **CRM** | Kanban pipeline (New Lead → Paying Client), contact history, bulk actions |
| **Outreach** | Email template library, variable fill-in, CASL-compliant send flow, open/reply tracking |
| **Marketing** | Ad spend tracker, revenue attribution, ROAS, Instagram metrics |
| **Operations** | Shoot pipeline, Matterport slot manager, invoice tracker |
| **Content** | Instagram content calendar with 5-pillar system, FR + EN captions |
| **Reports** | Auto-generated Monday weekly report from aggregated analytics |
| **Tools** | Realtor.ca scraper for lead sourcing |
| **Settings** | Pricing tiers, SMTP config, cron job status + manual triggers |

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd spatia-dashboard
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` and keys from your Supabase project
- `ZOHO_SMTP_USER` / `ZOHO_SMTP_PASSWORD` for outreach emails
- `NEXT_PUBLIC_APP_URL` (use `http://localhost:3000` for dev)

### 3. Apply database migrations

In your Supabase dashboard → SQL Editor, run the migration files in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_crm_module.sql
supabase/migrations/003_calendar_events.sql
supabase/migrations/004_cron_and_settings.sql
supabase/migrations/005_weekly_reports.sql
supabase/migrations/006_scraper.sql
```

### 4. Seed demo data (optional)

Populates 30 contacts, 5 shoots, 3 tours, 30 days of analytics, emails, and content:

```bash
npm run seed
```

### 5. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your Supabase auth credentials.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Search contacts (spotlight) |
| `⌘N` | New contact |
| `⌘E` | New email |
| `⌘⇧S` | New shoot |
| `?` | Show all shortcuts |

---

## Deployment (Docker)

### Build and run

```bash
# Copy and fill env vars
cp .env.local.example .env.local

# Build image
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com \
  -t spatia-dashboard .

# Run
docker run -p 3000:3000 --env-file .env.local spatia-dashboard
```

### Or with docker-compose

```bash
docker-compose up -d
```

### Health check

```
GET /api/health
→ { "status": "ok", "cron_registered": true, "db_connected": true }
```

### Hosting options

- **Railway** — push to GitHub, connect repo, set env vars, deploy. Auto-detects Dockerfile.
- **Fly.io** — `fly launch`, then `fly secrets set KEY=value` for each env var.
- **VPS** — install Docker, clone repo, `docker-compose up -d`.

---

## Cron Jobs

All background jobs run inside the Next.js process via `node-cron`. They register at server start (see `instrumentation.ts`).

| Job | Schedule | Action |
|-----|----------|--------|
| `listing-monitor` | Daily 2:00 AM | Check listing URLs for sold status |
| `followup-reminder` | Daily 9:00 AM | Flag contacts due for follow-up |
| `analytics-snapshot` | Daily 11:59 PM | Aggregate metrics into `analytics_daily` |
| `tour-slot-check` | Daily 6:00 AM | Check Matterport slot usage vs limit |
| `tax-threshold` | Monday 8:00 AM | Alert if YTD revenue approaching $30K |
| `invoice-overdue` | Daily 8:00 AM | Flag unpaid overdue invoices |
| `weekly-report` | Monday 7:00 AM | Generate and store last week's report |

Manual triggers available at `/settings` → Cron Jobs, or via:
```
GET /api/cron/trigger/[jobName]   (requires CRON_SECRET header in production)
```

---

## Notes

- **No AI API calls at runtime.** Email drafting is done manually in Claude.ai; templates are pasted in.
- **CASL compliant** — implied consent only, unsubscribe link in every email, one follow-up max.
- **Quebec Bill 96** — all client-facing outreach is French-first.
- **Single-user auth** — Supabase email/password login for Luca only. No public registration.
- **Beta pricing is private** — never appears in any public-facing output.
