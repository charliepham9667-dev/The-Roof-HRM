# Integration Map

*Last updated: 2026-04-22 | All active integrations between AIOS and external systems*

---

## Integration Inventory

| Integration | Direction | Status | Blocker |
|---|---|---|---|
| Google Sheets (Sales26) | AIOS reads | 🔴 Blocked | `operations_sheet_links` table empty |
| Accountant email / Excel | AIOS reads | ✅ Active | Manual paste — working |
| Google Ads (`ads-sync`) | HRM writes, AIOS reads | ✅ Active | Ads paused Apr 13 — no new rows until budget refilled |
| Google Business reviews | HRM writes, AIOS reads | ✅ Active | `sync-google-reviews` Edge Function live |
| Social media reports | AIOS reads (screenshot) | 🟡 Partial | 2 months live. Monthly upload by Nhi needed. |
| Notion | AIOS writes | ✅ Active | Daily briefing pages + monthly reports |
| Gmail | AIOS reads + drafts | ✅ Active | Read/draft only — Charlie sends |
| Supabase (MCP) | AIOS reads + writes | ✅ Active | Write requires approval |

---

## Integration 1: Google Sheets (Sales26)

**What it provides:** Daily revenue + pax, monthly P&L budget vs actual, events calendar, staff salary rates.

**Spreadsheet ID:** `1xAWccI666vfcoUWpMzQyrlQ-sZ4ggkPS7oNwfIx71iw`

### Auth Method
- Google OAuth via `google-auth` + `google-auth-callback` Edge Functions
- OAuth tokens stored in Supabase; refreshed via Edge Function when expired
- AIOS reads via Claude Code `mcp__google-sheets__get_sheet_data` OR via direct `csv_export_url` (preferred — no token needed if sheet is published)

### Input Format

| Tab | Columns AIOS cares about | Format notes |
|---|---|---|
| Sales | Date, Revenue by category, Total, Pax, AD (review count MTD), AE (review count WTD) | Dates as `DD/MM/YYYY` or `YYYY-MM-DD` — normalize on read |
| PnL 2026 | Month, Gross Sales, Budget Gross Sales, Labor Cost, Total Expenses, EBIT | Numbers in VND, no currency symbols |
| Salary | Staff name, Role, Monthly salary, Pay type | Source of truth for `/hr` skill when `org_chart.md` is stale |
| Calendar | Event title, Date, Type | Used for upcoming events in weekly briefing |

### Read Path (preferred)
1. AIOS queries `operations_sheet_links` table: `SELECT csv_export_url FROM operations_sheet_links WHERE kind = 'sales'`
2. AIOS fetches that URL via `WebFetch`
3. Parse CSV, use data

### Current Blocker
`operations_sheet_links` has 0 rows. Until populated, AIOS uses hardcoded URLs from `CLAUDE.md` as fallback — but these can expire.

**Fix:** Insert 4 rows into `operations_sheet_links`:
```sql
INSERT INTO operations_sheet_links (kind, sheet_title, sheet_url, csv_export_url) VALUES
  ('sales',    'Sales26 — Daily Revenue',    'https://docs.google.com/spreadsheets/d/1xAWccI666vfcoUWpMzQyrlQ-sZ4ggkPS7oNwfIx71iw', '[TBD: CSV export URL for Sales tab]'),
  ('pnl',      'Sales26 — PnL 2026',         'https://docs.google.com/spreadsheets/d/1xAWccI666vfcoUWpMzQyrlQ-sZ4ggkPS7oNwfIx71iw', '[TBD: CSV export URL for PnL 2026 tab]'),
  ('salary',   'Sales26 — Salary',           'https://docs.google.com/spreadsheets/d/1xAWccI666vfcoUWpMzQyrlQ-sZ4ggkPS7oNwfIx71iw', '[TBD: CSV export URL for Salary tab]'),
  ('calendar', 'Sales26 — Calendar Events',  'https://docs.google.com/spreadsheets/d/1xAWccI666vfcoUWpMzQyrlQ-sZ4ggkPS7oNwfIx71iw', '[TBD: CSV export URL for Calendar tab]');
```

### Retry Behavior
- HTTP timeout: retry once after 5 seconds
- 403 Forbidden: OAuth expired → re-authenticate via `google-auth` Edge Function, retry
- 404 Not Found: sheet URL changed → update `operations_sheet_links`, notify Charlie
- After 2 failed retries: fall back to most recent CSV file in `The Roof/2-data/`, note data is potentially stale

### Monitoring Signals
- `operations_sheet_links.updated_at` — if any row hasn't been updated in >30 days, check URLs still work
- AIOS should confirm `csv_export_url` returns 200 at start of weekly briefing
- If Sales tab returns 0 rows: something is wrong with the URL — do not proceed with weekly analysis

---

## Integration 2: Accountant Email / Excel (Daily Revenue Input)

**What it provides:** Daily revenue breakdown by category + bank balance. The primary input for the daily intelligence loop.

**Frequency:** Daily ~11:30AM ICT. Sent by Thu (Accountant).

### Auth Method
- Gmail MCP reads `charliepham9667@gmail.com`
- OAuth credentials in Claude Code MCP config
- AIOS can search emails but never sends

### Input Format

Two common formats:

**Format A — Excel screenshot (most common):**
- Charlie pastes screenshot as image into AIOS chat
- AIOS uses vision to extract: revenue rows by category, total, pax, bank balance
- Column order varies — AIOS should identify by label, not position

**Format B — Copy-pasted text:**
```
Cocktails: 18,500,000
Wine: 6,200,000
Spirits: 4,800,000
Shisha: 12,300,000
Beer: 3,100,000
Food: 2,400,000
Other: 800,000
Total: 48,100,000
Pax: 87
Bank: 1,728,057,427
```

**Format C — Typed summary by Charlie:**
- "cocktails 18.5M, wine 6.2M, shisha 12.3M, total 48M, 87 pax, bank 1.73B"
- AIOS normalizes shorthand (18.5M → 18,500,000)

### Parse/Transform Rules
- All amounts: normalize to VND integers (strip commas, convert M/B shorthand: `18.5M` → `18,500,000`, `1.73B` → `1,730,000,000`)
- Date: use "today" unless email/screenshot shows a different date
- Missing categories: set to 0, note which were absent
- Bank balance: map to `finance_cash_position_daily.bank_balance_vnd`
- Cash on hand: map to `finance_cash_position_daily.cash_balance_vnd` (often not provided — leave as 0)

### Retry Behavior
- If screenshot is unreadable: ask Charlie to re-paste or type values
- If email not received by 1PM: AIOS surfaces a note in daily briefing — "Revenue not entered yet — ping Thu"
- If data looks wrong (revenue > 200M or < 5M): flag before writing, ask Charlie to confirm

### Monitoring Signals
- Daily briefing Notion page should show "💰 Revenue & Cash" section populated by 2PM
- If section is missing at 2PM: prompt Charlie to enter data
- If the same revenue figure appears 3 days running (copy-paste error): flag to Charlie

---

## Integration 3: Google Ads + Google Business Reviews

### Google Ads (`ads-sync` Edge Function)

**What it provides:** Daily campaign performance — impressions, clicks, CTR, CPC, spend, conversions per campaign.

- **Edge Function:** `ads-sync` (v3, no JWT)
- **Writes to:** `ads_campaigns_daily` table
- **Frequency:** Daily (cron schedule on Edge Function — **TBD: confirm cron schedule in Supabase**)
- **Current data:** 20 rows live. Ads paused April 13 (budget ran out) — no new rows until Charlie reactivates.

**AIOS reads:** `SELECT * FROM ads_campaigns_daily WHERE metric_date >= [start_date] ORDER BY metric_date`

**Parse rules:** All monetary fields already in VND. CTR and CPC are computed columns (may be null if impressions = 0 — AIOS should treat null CTR as 0% for threshold checks).

**Monitoring signal:** `ads_campaigns_daily` should have at least 1 new row per day when campaigns are active. If 3+ days pass with no new rows and Google Ads account has active budget: check `ads-sync` Edge Function logs in Supabase dashboard.

### Google Business Reviews (`sync-google-reviews` Edge Function)

**What it provides:** New Google Business Profile reviews synced to `google_reviews` table + `daily_metrics.google_review_count` updated.

- **Edge Function:** `sync-google-reviews` (v17, no JWT)
- **Writes to:** `google_reviews` table + `daily_metrics`
- **Frequency:** **TBD (owner input needed)** — confirm how often this Edge Function runs (daily? on-demand?)
- **Current data:** `daily_metrics.google_review_count` is live (1,347 total reviews as of April 2026)

**AIOS reads:** `daily_metrics.google_review_count` and `daily_metrics.google_rating` for KPI tracking.

**Parse rules:** `google_rating` is a decimal (e.g., `4.8`). `google_review_count` is total cumulative count — AIOS calculates new reviews by comparing to prior period.

**Monitoring signal:** `daily_metrics.google_rating` should never decrease by more than 0.1 in a single day. If it does: check for new negative reviews and flag to Nhi for response.

---

## Integration 4: Social Media Reports (Manual Upload)

**What it provides:** Monthly Instagram, Facebook, TikTok, and Google Business performance summary.

- **Input:** Nhi uploads screenshot of monthly social report to HRM (or sends in Zalo)
- **AIOS processes:** Screenshot → parsed JSON → stored in `marketing_social_monthly_reports.payload`
- **Frequency:** Once per month, first week of new month
- **Current data:** 2 rows live (March + April 2026)

**Parse rules:** AIOS uses vision to extract numbers from screenshot. Maps to payload structure (see `data-contracts.md`). If a platform's data is missing from the screenshot, leave that key absent from payload — do not fill with zeros.

**Monitoring signal:** If `marketing_social_monthly_reports` has no row for the prior month by the 7th of the new month: prompt Charlie to ask Nhi to upload the screenshot.

**Known data issue:** March 2026 row shows `google.total_reviews: 1535` but April shows `1353` — total reviews cannot decrease. One of these rows has a data entry error. **Flag to Nhi to correct.**
