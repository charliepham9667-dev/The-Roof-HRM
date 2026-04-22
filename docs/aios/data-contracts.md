# Data Contracts

*Last updated: 2026-04-22 | Supabase project: gewlgslgltrhnwrsttsm*
*All column names, types, and examples verified against live database.*

---

## What is a Data Contract?

A data contract defines the expected shape, rules, and meaning of a table. It's the agreement between whoever writes data and whoever reads it (AIOS). If a row breaks these rules, AIOS should flag it — not silently use bad data.

---

## Contract 1: `finance_cash_position_daily`

**Purpose:** Daily snapshot of The Roof's cash and bank position. One row per day. Entered by Thu from the accountant email (~11:30AM).

**Current status:** 1 row live (2026-04-21). `cash_balance_vnd` is 0 in all rows — needs process fix.

### Schema

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `report_date` | date | NO | — | The date this snapshot covers. Must be unique. |
| `bank_balance_vnd` | numeric | NO | 0 | BIDV bank balance in VND. This is what's being entered. |
| `cash_balance_vnd` | numeric | NO | 0 | Physical cash on hand at venue. Often 0 — needs fixing. |
| `total_vnd` | numeric | YES | — | Computed: `bank_balance_vnd + cash_balance_vnd`. May be null if not set. |
| `notes` | text | YES | — | Free-text context (e.g., "Sent on 21st of April") |
| `source_file_path` | text | YES | — | Storage path of uploaded screenshot/PDF |
| `source_file_name` | text | YES | — | Original filename of the source document |
| `source_file_mime_type` | text | YES | — | MIME type (e.g., `image/png`, `application/pdf`) |
| `source_file_size_bytes` | bigint | YES | — | File size in bytes |
| `created_by` | uuid | YES | — | FK → `profiles.id` — who entered this row |
| `updated_by` | uuid | YES | — | FK → `profiles.id` — who last updated |
| `created_at` | timestamptz | NO | `now()` | Auto-set on insert |
| `updated_at` | timestamptz | NO | `now()` | Auto-updated on change |

### Uniqueness
- `report_date` must be unique. One row per calendar day.
- If a duplicate date is attempted: update the existing row, do not insert a new one.

### Validation Rules
- `bank_balance_vnd >= 0` (never negative)
- `cash_balance_vnd >= 0` (never negative)
- `report_date <= CURRENT_DATE` (no future dates)
- `total_vnd` should equal `bank_balance_vnd + cash_balance_vnd` (if populated)
- Flag if `bank_balance_vnd = 0` AND no notes explaining why

### Real Example Row
```
report_date:      2026-04-21
bank_balance_vnd: 1,728,057,427
cash_balance_vnd: 0               ← known gap: physical cash not entered
total_vnd:        1,728,057,427
notes:            "Sent on 21st of April"
source_file_name: "unnamed.png"
```

### Known Issues
- `cash_balance_vnd` is 0 on all existing rows. Thu is only entering bank balance. Physical cash-on-hand is not being tracked. **Action needed:** Update daily entry process with Thu to include cash drawer count.
- `total_vnd` may be null on older rows — compute it as `bank_balance_vnd + cash_balance_vnd` in AIOS queries.

### How AIOS Uses This Table
- `/expense-dashboard`: reads most recent row for cash runway calculation
- `/business-intelligence`: checks against 🟢≥500M / 🟡200–499M / 🔴<200M thresholds
- Daily health check: shows cash position in morning briefing
- Weekly loop: checks 7-day cash trend

---

## Contract 2: `finance_supplier_debt_weekly`

**Purpose:** Weekly snapshot of total outstanding debt owed to suppliers (beverage, shisha, food, event suppliers). Entered by Thu every Friday close.

**Current status:** 0 rows. Not yet active. Thu needs to begin weekly entry.

### Schema

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `report_date` | date | NO | — | The Friday date this snapshot covers |
| `total_debt_vnd` | numeric | NO | 0 | Total outstanding amount owed to all suppliers |
| `total_overdue_vnd` | numeric | YES | — | Subset of total_debt that is past due date |
| `notes` | text | YES | — | Free-text context (e.g., "Includes Diageo invoice from Mar 15") |
| `source_file_path` | text | YES | — | Storage path of supporting document |
| `source_file_name` | text | YES | — | Original filename |
| `source_file_mime_type` | text | YES | — | MIME type |
| `source_file_size_bytes` | bigint | YES | — | File size in bytes |
| `created_by` | uuid | YES | — | FK → `profiles.id` |
| `updated_by` | uuid | YES | — | FK → `profiles.id` |
| `created_at` | timestamptz | NO | `now()` | Auto-set on insert |
| `updated_at` | timestamptz | NO | `now()` | Auto-updated on change |

### Uniqueness
- `report_date` should be unique per Friday. One aggregate row per week — not one row per supplier.
- If individual supplier breakdown is needed, use `notes` field.

### Validation Rules
- `total_debt_vnd >= 0`
- `total_overdue_vnd <= total_debt_vnd` (if both are populated)
- `report_date` should be a Friday (AIOS can flag if it's not, but still accept)
- Flag if `total_debt_vnd` jumps more than 50% week-over-week

### Example Row (target state once active)
```
report_date:       2026-04-25    ← Friday
total_debt_vnd:    85,000,000    ← 85M VND total outstanding
total_overdue_vnd: 12,000,000    ← 12M VND past due
notes:             "Diageo: 45M (due May 1), Shisha supplier: 28M (due Apr 30), Food: 12M (overdue from Mar)"
```

### **TBD (owner input needed)**
- What is the current typical total supplier debt amount? (baseline for anomaly detection)
- Does Thu already track this somewhere? (Zalo, Excel, HRM?) — confirm source before building automation
- Should individual supplier lines be tracked, or just totals? (affects whether this table is sufficient)

### How AIOS Uses This Table
- `/expense-dashboard`: payment priority list — overdue amounts surface as top priority
- Weekly close: cash runway calculation includes upcoming supplier payments
- Monthly report: supplier debt trend section

---

## Contract 3: `operations_sheet_links`

**Purpose:** Registry of all Google Sheet URLs that AIOS uses to read live data. This table is the bridge between AIOS and Google Sheets. Without rows here, AIOS falls back to hardcoded URLs in skills (fragile).

**Current status:** 0 rows. **This is a current blocker.** AIOS cannot auto-read Google Sheets until populated.

### Schema

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `kind` | text | NO | — | Identifier for this data source (e.g., `"sales"`, `"pnl"`, `"salary"`, `"calendar"`) |
| `sheet_url` | text | NO | — | Full Google Sheets URL (for human access) |
| `embed_url` | text | YES | — | Embed URL for iframe display in HRM |
| `csv_export_url` | text | YES | — | Direct CSV export URL — this is what AIOS reads |
| `sheet_title` | text | YES | — | Human-readable label (e.g., "Sales26 — Daily Revenue") |
| `updated_by` | uuid | YES | — | FK → `profiles.id` — who last updated |
| `created_at` | timestamptz | NO | `now()` | Auto-set on insert |
| `updated_at` | timestamptz | NO | `now()` | Auto-updated on change |

### Uniqueness
- `kind` should be unique. One row per data type.

### Validation Rules
- `sheet_url` must start with `https://docs.google.com/spreadsheets/`
- `csv_export_url` must be accessible (returns 200, not 403/404)
- If `csv_export_url` returns 403 → Google auth expired. Re-authenticate via `google-auth` Edge Function.

### Required Rows to Insert (action item)

| kind | sheet_title | Notes |
|---|---|---|
| `sales` | Sales26 — Daily Revenue + Pax | CSV export of Sales tab (daily rows) |
| `pnl` | Sales26 — PnL 2026 | CSV export of PnL 2026 tab (monthly rows) |
| `salary` | Sales26 — Salary | CSV export of Salary tab (staff pay rates) |
| `calendar` | Sales26 — Calendar | CSV export of Calendar tab (events) |

**How to get the CSV export URL for a Google Sheet tab:**
1. Open the spreadsheet
2. Go to the target tab
3. File → Share → Publish to web → CSV → Copy link
4. That link is the `csv_export_url`

### How AIOS Uses This Table
- Skills read `csv_export_url` for the relevant `kind` at runtime
- Replaces all hardcoded Google Sheets URLs in skills (fragile) with a single lookup
- If a URL changes, only this table needs updating — not every skill file

---

## Contract 4: `marketing_social_monthly_reports`

**Purpose:** Monthly social media performance data. One row per calendar month. Populated when Nhi uploads a screenshot of the monthly social report to the HRM, and AIOS parses it into structured JSON.

**Current status:** 2 rows live (March 2026 and April 2026).

### Schema

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `report_month` | date | NO | — | Always the first day of the month (e.g., `2026-04-01` for April) |
| `source_file_name` | text | YES | — | Original filename of uploaded screenshot |
| `source_file_path` | text | YES | — | Storage path of uploaded file |
| `source_file_mime_type` | text | YES | — | MIME type of upload |
| `source_file_size_bytes` | bigint | YES | — | File size in bytes |
| `payload` | jsonb | NO | `{}` | All social metrics as structured JSON — see schema below |
| `created_by` | uuid | YES | — | FK → `profiles.id` |
| `updated_by` | uuid | YES | — | FK → `profiles.id` |
| `created_at` | timestamptz | NO | `now()` | Auto-set on insert |
| `updated_at` | timestamptz | NO | `now()` | Auto-updated on change |

### Uniqueness
- `report_month` must be unique. One row per calendar month.

### Payload JSON Schema (confirmed from live data)

```json
{
  "google": {
    "searches": 7500,
    "new_reviews": 10,
    "star_rating": 4.8,
    "total_reviews": 1353,
    "direction_requests": 3500,
    "unanswered_reviews": 10
  },
  "tiktok": {
    "avg_views": 500,
    "new_followers": 115,
    "profile_visits": 1573
  },
  "facebook": {
    "reach": 7200,
    "new_likes": 139,
    "link_clicks": 118,
    "profile_visits": 4000,
    "engagement_rate": 31.5
  },
  "instagram": {
    "reach": 5500,
    "link_clicks": 19,
    "new_followers": 111,
    "profile_visits": 2300,
    "engagement_rate": 20
  }
}
```

All fields are nullable within the payload — not every platform may have data every month.

### Validation Rules
- `report_month` must be a date where `DAY(report_month) = 1`
- `payload` must not be `{}` (empty) — if AIOS can't parse the screenshot, flag it
- `payload.google.star_rating` must be between 1.0 and 5.0
- `payload.google.new_reviews` must be ≥ 0
- Flag if `new_reviews` for current month < prior month (review count shouldn't decrease)

### Real Example Rows
```
April 2026:
  google.new_reviews: 10
  google.star_rating: 4.8
  google.total_reviews: 1353
  facebook.new_likes: 139
  instagram.new_followers: 111
  tiktok.new_followers: 115

March 2026:
  google.total_reviews: 1535  ← note: higher than April's 1353 (likely data entry error)
  tiktok.avg_views: 1000 (vs 500 in April — performance dip to investigate)
```

**Note:** March shows `total_reviews: 1535` but April shows `1353` — this is inconsistent (reviews can't decrease). Likely a data entry error in one of the rows. Flag this for Nhi to correct.

### How AIOS Uses This Table
- `/monthly-report`: social media section (reach, followers, engagement)
- Google reviews cross-check: `payload.google.new_reviews` vs `daily_metrics.google_review_count`
- `/google-data-entry`: reads this as secondary source for review counts
