# Spatia Growth Command Center — Overnight Changes
## Date: 2026-04-09
## Session Duration: ~2 hours

---

### API Integrations

- **Wave Financial**: Not connected — no `WAVE_ACCESS_TOKEN` found in `.env.local`. Created setup guide at `/settings/wave` with step-by-step instructions to generate an OAuth token at developer.waveapps.com and add the required env vars. Existing manual invoices and Wave CSV import continue to work.

- **Matterport API**: Not connected — no `MATTERPORT_TOKEN_ID` / `MATTERPORT_TOKEN_SECRET` found in `.env.local`. Created setup guide at `/settings/matterport` with instructions for generating API credentials from my.matterport.com → Developer Tools. Manual slot tracking via the settings table continues to work.

---

### Features Added

1. **Wave setup page** (`/settings/wave`): Full instructions page explaining what Wave integration unlocks (invoice sync, YTD auto-calc, overdue detection) and exactly how to connect it. Actionable links to manual fallbacks while not connected.

2. **Matterport setup page** (`/settings/matterport`): Full instructions page explaining what Matterport API unlocks (real-time space inventory, slot tracking, auto-delivery detection) and how to generate API credentials.

3. **Outreach streak tracker**: Flame icon + day count in the command center scoreboard. Calculates consecutive days with at least one sent email. Shows "inactif Xj" when streak is broken. Live from Supabase on every page load.

4. **New contact quick-add dialog**: Triggered by `?new=1` URL param (from ⌘N shortcut and "nouveau" button in CRM header), or the "nouveau" button added to the CRM page header. Pre-fills `language: "fr"` and `areas_served: ["Rive-Sud", "Grand Montréal"]` as smart defaults. Dialog closes cleanly and removes the param from the URL.

5. **Shoot form smart default**: `scheduled_at` now defaults to tomorrow at 9:00 AM when creating a new shoot. No more manual date entry for the most common case.

---

### Features Removed / Disabled

1. **`/operations/invoices` duplicate**: Redirected to `/money/invoices`. Both pages used the exact same `InvoicesTracker` component — this was 100% redundant. One canonical invoice page now.

2. **"home" sidebar item removed**: The `/` home dashboard is now accessible by clicking the "spatia" brand logo in the sidebar. Removes clutter from nav — command center is the first item.

3. **"notes" standalone sidebar item removed**: Moved under Settings submenu. Still fully accessible via ⌘K → "notes" or direct link.

4. **"reports" standalone sidebar item removed**: Moved under Settings submenu. Still accessible via ⌘K → "rapport hebdomadaire".

5. **"scraper" standalone sidebar item removed**: Moved under Settings submenu. Still accessible via ⌘K → "scraper".

---

### Consolidation Changes

1. **Sidebar: 11 → 6 top-level items**. Before: command, home, crm, outreach, marketing, operations, money, notes, reports, scraper, settings. After: **command, crm, outreach, shoots, money, settings**. All pages are still accessible — they're just organized as submenus.

2. **Marketing merged into Outreach submenu**: Queue, Campaigns, Templates, Analytics, Content Calendar, Marketing overview, Meta Ads, Organic, Import Meta — all under the Outreach nav item with `activeAlso` covering `/marketing` and `/content` paths.

3. **Settings submenu expanded**: Now includes Goals, Automation (cron), Email, Wave (new), Matterport (new), Export, Weekly Report, Notes, Scraper.

4. **Settings index page**: Two new cards added (Wave Financial and Matterport API) with connection status badges. "setup" badge (amber) when not connected, green dot when connected.

---

### Automation Improvements

1. **All 9 cron jobs verified running**: listing-monitor (2am daily), followup-reminder (9am daily), analytics-snapshot (11:59pm daily), tour-slot-check (6am daily), tax-threshold (8am Mondays), invoice-overdue (8am daily), weekly-report (7am Mondays), campaign-health (7am daily), shoot-today (6:30am daily). All wired in `instrumentation.ts` via `registerCronJobs()`.

2. **Follow-up automation confirmed**: Contacts in `first_email_sent` status with no reply after 7 days get `followup_due` tag + action item on command center. Surfaced in the ActionItemsPanel with "Ouvrir courriel" quick action.

3. **Listing monitoring confirmed**: Checks Realtor.ca listing URLs for redirect (sold signal) or "vendu"/"sold" text. Creates action item on command center + updates tour status to `archive_recommended`.

---

### Bug Fixes

1. **`?new=1` param was a dead end**: ⌘N and the command palette "Nouveau contact" quick action both navigated to `/crm?new=1` which previously did nothing. Now opens the new contact dialog.

2. **Sidebar `activeAlso` logic**: Previously the sidebar activated "marketing" for `/content` paths via a hardcoded special case. Now the `activeAlso` field on each nav item handles this generically.

---

### UI/UX Improvements

1. **Actionable empty state — taxes page**: Instead of "no data yet — import Wave CSV to populate", now shows two CTAs: "ajouter une facture →" and "import wave csv →".

2. **Actionable empty state — shoots list**: Instead of "no shoots found", now shows instructions and keyboard shortcut hint (⌘⇧S).

3. **Brand logo as home link**: Clicking the "S" logo in the desktop sidebar navigates to `/`. Reduces the need for a dedicated "home" nav item.

4. **Settings connection status**: Wave and Matterport cards in settings index show connection status inline — amber "setup" badge when not connected, green dot when connected. Driven by env var presence check at render time.

---

### Build Status

- `npm run build`: **PASS** — 76 pages, 0 errors, 0 warnings
- All new routes (`/settings/wave`, `/settings/matterport`) confirmed in build output

---

### Known Issues / Next Steps

1. **Wave integration**: Pending OAuth token from developer.waveapps.com. Once `WAVE_ACCESS_TOKEN` is in `.env.local`, build `/lib/wave/client.ts` + `/api/wave/sync` route + cron job.

2. **Matterport integration**: Pending API credentials from my.matterport.com. Once `MATTERPORT_TOKEN_ID` + `MATTERPORT_TOKEN_SECRET` are set, build `/lib/matterport/client.ts` + `/api/matterport/sync` route + cron job.

3. **Shoot profitability view**: Not built this session (Phase 5 item — would need invoices joined to shoots + distance estimate). Good next-session target.

4. **Quick invoice from shoot**: "Generate Invoice" button exists on delivered shoots in operations. Worth verifying it pre-fills correctly from shoot data.

5. **Portfolio readiness indicator**: Not built this session (Phase 5).

---

### Files Changed

**Created:**
- `app/(dashboard)/settings/wave/page.tsx` — Wave API setup guide
- `app/(dashboard)/settings/matterport/page.tsx` — Matterport API setup guide

**Modified:**
- `app/(dashboard)/settings/page.tsx` — Added Wave + Matterport cards with status badges
- `app/(dashboard)/command/page.tsx` — Added `getOutreachStreak()` + Flame streak display in scoreboard
- `app/(dashboard)/crm/page.tsx` — Added "nouveau" button, Suspense wrapper for search params
- `app/(dashboard)/operations/invoices/page.tsx` — Replaced with redirect to `/money/invoices`
- `app/(dashboard)/money/taxes/page.tsx` — Actionable empty state
- `components/layout/sidebar.tsx` — Consolidated from 11 to 6 items, brand logo → home link
- `components/crm/kanban-board.tsx` — Added `NewContactDialog`, `?new=1` handling, smart defaults
- `components/operations/shoot-form.tsx` — Added `defaultScheduledAt()` (tomorrow 9am)
- `components/operations/shoots-list.tsx` — Actionable empty state with keyboard hint
