# Operations Runbook

*Last updated: 2026-04-22 | Day-1 setup, daily ops, failure recovery, backfill procedures*

---

## Day-1 Startup Checklist

Run these checks before trusting any AIOS output in a new session or after a long break.

### Connectivity
- [ ] **Supabase MCP:** Run `SELECT NOW()` via `mcp__supabase__execute_sql` → should return current ICT timestamp (UTC+7)
- [ ] **Supabase read:** `SELECT COUNT(*) FROM daily_metrics WHERE date >= CURRENT_DATE - 7` → should return 7 (or close)
- [ ] **Google Sheets MCP:** `mcp__google-sheets__get_sheet_data` on Sales26 first row → should return date + revenue columns
- [ ] **Notion MCP:** Fetch today's daily briefing page → should return page content, not 404
- [ ] **Gmail MCP:** `search_threads` for "accountant" or Thu's email address → should return recent threads

### Data Freshness
- [ ] `finance_cash_position_daily`: has a row for yesterday or today
- [ ] `daily_metrics`: has a row for yesterday (revenue > 0)
- [ ] `operations_sheet_links`: has 4 rows (`kind` = sales, pnl, salary, calendar) — **if 0 rows, Google Sheets integration is not working**
- [ ] `ads_campaigns_daily`: has rows from past 3 days (if campaigns are active)

### Schedules
- [ ] Cron jobs configured in `.claude/settings.json`:
  - `30 9 * * *` — morning briefing (9:30AM)
  - `30 12 * * *` — revenue update (12:30PM)
  - `0 0 * * *` — EOD review (midnight)
  - `0 9 * * 0` — weekly briefing (Sunday 9AM, every 2 weeks)

### Context
- [ ] Review `Charlie/current-priorities.md` — is focus still accurate?
- [ ] Check `decisions/log.md` — any open items from last session?
- [ ] Check `The Roof/3-intelligence/rules.md` — are thresholds current? (monthly targets change)

---

## Daily Operating Procedure

### Morning (9:30AM — auto via cron)
- AIOS creates "Charlie's Day" Notion page
- Big 3 tasks populated from HIGH priority Notion column
- Daily habits tracker, week view, On Going / Follow Up / Delegate sections
- Monday only: Zalo team message draft + weekly pulse questions

### Mid-day (11:30AM–1PM — Charlie initiates)
- Charlie pastes accountant email/screenshot into AIOS chat
- Run `/daily-data-entry`
- Notion page updates with "💰 Revenue & Cash" section
- Daily health check output (5 lines)

### Evening (8PM–midnight — as needed)
- AIOS available for ad-hoc queries (`/business-intelligence`)
- EOD review fires at midnight (auto via cron)

### Monday extra tasks (manual, after mid-day entry)
- `/google-data-entry` — log review count from Sales26 columns AD/AE
- `/expense-tracker` — paste BIDV emails (max 5 at a time)
- `/staff-follow-up` — check HRM task status, draft Zalo messages
- `/inventory-intelligence` — if Phu or Long has submitted stock count

---

## Failure Recovery Procedures

### Supabase MCP unavailable

**Symptoms:** `mcp__supabase__execute_sql` returns error or times out.

**Recovery:**
1. Fall back to CSV layer: read `The Roof/2-data/revenue/YYYY_MM_revenue.csv` directly
2. Note which Supabase data is missing/stale in the output (e.g., "Staff contract status unavailable — using last known")
3. Continue with available CSV data — clearly label any section based on stale/missing data
4. Try MCP again in 30 minutes
5. If outage persists: check Supabase status page (status.supabase.com)

**Do not:** Stop the briefing entirely. Generate the best output available with caveats.

### Google Sheets inaccessible (403 or timeout)

**Symptoms:** csv_export_url returns 403 Forbidden or WebFetch times out.

**Recovery:**
1. Check `operations_sheet_links` — is the URL still correct?
2. If 403: Google OAuth may have expired. Trigger `google-auth` Edge Function to re-authenticate.
3. Fall back to most recent CSV export in `The Roof/2-data/` (note staleness date)
4. Proceed with stale data, clearly flagged in output

### Morning briefing cron didn't fire

**Symptoms:** No Notion page created by 10AM.

**Recovery:**
1. Check cron schedule in `.claude/settings.json`
2. Run `/daily-briefing` manually in a new AIOS session
3. If cron config is missing: re-add it via the `update-config` skill

### Revenue not entered by 2PM

**Recovery:**
1. Check Gmail: search for Thu's accountant email
2. If email not received: Charlie pings Thu on Zalo
3. If Thu is unavailable: pull revenue from HRM dashboard manually (or ask Thuy to log it)
4. If no data available: create daily briefing with "Revenue: PENDING — data not received" in the cash section

### AIOS wrote wrong data to CSV

**Recovery:**
1. Identify the file (`The Roof/2-data/revenue/YYYY_MM_revenue.csv` or cashflow)
2. Find the correct values (accountant email, HRM dashboard)
3. Edit the specific row in the CSV file
4. If Supabase `daily_metrics` was also written with wrong data: update that row (requires Charlie approval)
5. Log in `decisions/log.md`: `[date] DECISION: Corrected [table/file] for [date] — [what was wrong] | REASONING: [source of correct data]`

### Notion MCP unavailable

**Recovery:**
1. Generate briefing content as text in the chat
2. Charlie can copy-paste into Notion manually
3. No data is lost — CSVs and Supabase are the source of truth

### Session ends mid-task

**Recovery:**
1. AIOS has no memory of mid-session work (only memory files persist)
2. Re-run the skill from the start in a new session
3. AIOS will detect any already-written rows (duplicate date checks) and skip them
4. Check what was already written before re-running

---

## Replay / Backfill Procedures

Use these when catching up on missing historical data.

### Backfill: Revenue (missing days)

1. Get historical data from Google Sheet Sales tab (tab: "Sales")
2. Identify missing dates in `The Roof/2-data/revenue/YYYY_MM_revenue.csv`
3. For each missing day, run `/daily-data-entry` with historical data pasted in
4. AIOS will detect no existing row for that date and write it
5. After backfill: verify CSV row count matches days in month

### Backfill: Cash Position (missing days)

1. Check BIDV bank statements (Thu has access to online banking history)
2. For each missing date, enter: `report_date`, `bank_balance_vnd`, notes explaining it's a backfill
3. AIOS can insert rows in bulk if Charlie provides a table of dates + balances
4. `cash_balance_vnd` can stay 0 for historical backfill (historical data doesn't have this)

### Backfill: Supplier Debt (starting from scratch)

1. Ask Thu: what is the current total owed to suppliers?
2. Ask: what was it 4 weeks ago, 8 weeks ago? (approximate is fine)
3. Insert 3–4 historical Friday rows into `finance_supplier_debt_weekly`
4. This establishes a baseline trend for the dashboard

### Backfill: Event Performance (Jan–Apr 2026)

1. Get event list from `events` Supabase table (82 rows exist)
2. For each club night event (Girls Night, Lovers & Friends, etc.):
   - Find revenue for that date in `daily_metrics` or Sales26
   - Estimate attendance from pax on that date
   - Estimate event cost (DJ payment from `dj_payments` table, promo materials)
3. Run `/event-performance` for each event with these inputs
4. Save to `The Roof/2-data/events/event_performance.csv`

### Backfill: Partners

1. Pull DJ list from `dj_profiles` table (12 DJs exist) + `dj_payments` (116 rows)
2. Add to `partners.csv` as "DJ" type partners with status "Active" or "Completed"
3. Add any brand sponsors, event partners from Charlie's memory
4. Run `/partner-pipeline` to validate and organize

### Backfill: Social Reports (missing months)

1. Ask Nhi for screenshots of prior monthly social reports (likely in Zalo history)
2. For each missing month, paste screenshot into AIOS chat
3. AIOS parses → inserts into `marketing_social_monthly_reports`
4. Note: March 2026 row exists but has a data error (`total_reviews: 1535` is inconsistent with April `1353`) — correct this

---

## Manual Mode Triggers

Stop automation and switch to full manual when:

- [ ] Bonus payment calculation is being finalized (always require Charlie sign-off)
- [ ] Any staff salary change is being processed
- [ ] Any output is going to a third party (investor, partner, supplier)
- [ ] Cash position drops below 100M VND (stop all automated spend recommendations until cash stabilizes)
- [ ] AIOS output contradicts what Charlie sees in HRM (investigate root cause before continuing)
- [ ] AIOS MCP connections have been down for >24 hours (all outputs are potentially stale)
- [ ] A new quarter starts (update `quarterly_objectives.md` + `current-priorities.md` before resuming automation)
