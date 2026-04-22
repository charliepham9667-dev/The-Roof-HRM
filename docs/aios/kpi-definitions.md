# KPI Definitions

*Last updated: 2026-04-22 | Canonical KPI dictionary for The Roof AIOS*
*All formulas reference live Supabase tables. Thresholds from The Roof/3-intelligence/rules.md.*

---

## How to Use This Document

Every KPI tracked by AIOS is defined here. When a skill references a KPI (e.g., "revenue is RED"), this document defines exactly what that means, where the data comes from, and what the threshold is.

**Update this document when:**
- Monthly targets change (update target column)
- A threshold is revised
- A new KPI is added to a skill
- A data source changes

---

## Revenue KPIs

### KPI-01: Daily Revenue

| Field | Value |
|---|---|
| **Formula** | `daily_metrics.revenue` for a given date |
| **Source table** | `daily_metrics` |
| **Update cadence** | Daily (~12:30PM, after accountant email entry) |
| **Owner** | Thu (Accountant) enters; AIOS reads |
| **Unit** | VND |

**Thresholds:**
- 🟢 Green: ≥ 50,000,000 VND (50M)
- 🟡 Yellow: 35,000,000–49,999,999 VND
- 🔴 Red: < 35,000,000 VND

**Uncertainty notes:** `daily_metrics.revenue` is the single-day total. Cross-check against Sales26 Google Sheet if there's a discrepancy. The two sources should match within ±1%.

---

### KPI-02: Month-to-Date Revenue

| Field | Value |
|---|---|
| **Formula** | `SUM(daily_metrics.revenue) WHERE date >= first day of current month AND date <= today` |
| **Source table** | `daily_metrics` |
| **Update cadence** | Daily |
| **Owner** | AIOS calculates automatically |
| **Unit** | VND |

**Monthly targets (2026):**

| Month | Target |
|---|---|
| January | 750,000,000 |
| February | 975,000,000 |
| March | 1,500,000,000 |
| April | 1,500,000,000 |
| May | 1,425,000,000 |
| June | 1,500,000,000 |
| July | 1,800,000,000 |
| August | 1,800,000,000 |
| September | 1,200,000,000 |
| October | 900,000,000 |
| November | 750,000,000 |
| December | 1,200,000,000 |

**MTD Pace formula:**
```
expected_mtd = (day_of_month / days_in_month) × monthly_target
pace_pct = actual_mtd / expected_mtd × 100%
```
- 🟢 Green: pace ≥ 100%
- 🟡 Yellow: pace 85–99%
- 🔴 Red: pace < 85%

---

### KPI-03: Monthly Revenue vs Target

| Field | Value |
|---|---|
| **Formula** | `pnl_monthly.gross_sales - monthly_target` |
| **Source table** | `pnl_monthly` |
| **Update cadence** | Monthly (after month close) |
| **Owner** | Thu enters PnL; AIOS calculates surplus/shortfall |

**Surplus = gross_sales > target → triggers bonus pool calculation**
**Shortfall = gross_sales < target → no bonus pool**

**Uncertainty notes:** Use `pnl_monthly.gross_sales` for official monthly calculation, NOT the sum of `daily_metrics.revenue`. The two may diverge slightly due to adjustments. `pnl_monthly` is the accounting source of truth.

---

### KPI-04: Average Spend per Pax

| Field | Value |
|---|---|
| **Formula** | `daily_metrics.avg_spend` OR `daily_metrics.revenue / daily_metrics.pax` |
| **Source table** | `daily_metrics` |
| **Update cadence** | Daily |
| **Owner** | AIOS calculates |
| **Unit** | VND per person |

No fixed threshold. Track trend over time. Flag if avg_spend drops >20% week-over-week.

---

## Cash KPIs

### KPI-05: Cash Position

| Field | Value |
|---|---|
| **Formula** | `finance_cash_position_daily.bank_balance_vnd + finance_cash_position_daily.cash_balance_vnd` |
| **Source table** | `finance_cash_position_daily` |
| **Update cadence** | Daily (~11:30AM) |
| **Owner** | Thu enters; AIOS reads |
| **Unit** | VND |

**Thresholds:**
- 🟢 Green: ≥ 500,000,000 VND (500M)
- 🟡 Yellow: 200,000,000–499,999,999 VND
- 🔴 Red: < 200,000,000 VND
- 🚨 Critical: < 100,000,000 VND → stop automation, switch to manual mode

**Uncertainty notes:** `cash_balance_vnd` is currently 0 on all rows. Use `bank_balance_vnd` as proxy for total cash position until Thu starts entering physical cash. This understates true cash position slightly.

---

### KPI-06: Cash Runway

| Field | Value |
|---|---|
| **Formula** | `current_cash_position / estimated_monthly_fixed_costs` |
| **Source table** | `finance_cash_position_daily` + `org_chart.md` for payroll |
| **Update cadence** | Weekly (Friday close) |
| **Owner** | AIOS calculates |
| **Unit** | Months |

**Estimated monthly fixed costs (Apr 2026):**
- Payroll: ~126,600,000 VND
- Rent + utilities + maintenance: **TBD (owner input needed)** — ask Charlie or Thu for current fixed cost total
- Total estimate: ~126.6M + TBD

**Thresholds:**
- 🟢 Green: > 3 months
- 🟡 Yellow: 2–3 months
- 🔴 Red: < 2 months

---

## HR / Labor KPIs

### KPI-07: HR Cost Ratio

| Field | Value |
|---|---|
| **Formula** | `pnl_monthly.labor_cost / pnl_monthly.gross_sales × 100` |
| **Source table** | `pnl_monthly` |
| **Update cadence** | Monthly |
| **Owner** | AIOS calculates from Thu's PnL entry |
| **Unit** | Percentage |

**Thresholds:**
- 🟢 Green: < 10%
- 🟡 Yellow: 10–12%
- 🔴 Red: > 12%

**Current benchmark:** April 2026 payroll ~126.6M VND. At 1.5B monthly revenue = 8.4% (green).

**Uncertainty notes:** `daily_metrics.labor_cost` is zero-filled — do NOT use it. Always use `pnl_monthly.labor_cost` for this KPI. The two fields are inconsistent.

---

### KPI-08: Monthly Surplus Bonus Pool

| Field | Value |
|---|---|
| **Formula** | `MAX(0, gross_sales - monthly_target) × 7%` |
| **Source table** | `pnl_monthly` + monthly targets from `quarterly_objectives.md` |
| **Update cadence** | Monthly |
| **Owner** | AIOS calculates; Charlie approves before sharing |
| **Unit** | VND |

**Google Review Gate modifier (applied to bonus pool payout):**
```
4.8★+ AND 100+ new reviews  → 100% of pool paid out
4.7★+ AND 70+ new reviews   → 70% of pool paid out
4.6★+ AND 35+ new reviews   → 35% of pool paid out
< 4.5★                      → 0% (no bonus)
```

**Distribution (of full pool):**
- Floor team (service + bar + shisha staff): 5% of surplus
- Thuy (Floor Manager): 1% of surplus
- Phu (Bar Manager): 0.5% of surplus
- Thu (Accountant): 0.5% of surplus

**Uncertainty notes:** This KPI requires Charlie's explicit approval before any numbers are shared with staff. Never auto-communicate bonus figures.

---

## Google Reviews KPIs

### KPI-09: Monthly New Reviews

| Field | Value |
|---|---|
| **Formula** | `daily_metrics.google_review_count` (end of month) - `daily_metrics.google_review_count` (start of month) |
| **Source table** | `daily_metrics` |
| **Update cadence** | Daily (synced by `sync-google-reviews` Edge Function) |
| **Owner** | Anh Tu (Head of Service) — accountable for driving reviews |
| **Target** | 100 new reviews per month |
| **Unit** | Count |

**Daily pace check:**
```
pace_target = (day_of_month / 30) × 100
status = actual_new_reviews_mtd >= pace_target ? On track : Behind
```

---

### KPI-10: Google Rating

| Field | Value |
|---|---|
| **Formula** | `daily_metrics.google_rating` |
| **Source table** | `daily_metrics` |
| **Update cadence** | Daily |
| **Owner** | Nhi (Marketing Manager) — manages review responses |
| **Target** | ≥ 4.8 stars |
| **Unit** | Rating (1.0–5.0) |

**Thresholds:**
- 🟢 Target: ≥ 4.8
- 🟡 Warning: 4.6–4.79
- 🔴 Critical: < 4.6

**Current (Apr 2026):** 4.8★ with 1,347+ total reviews.

---

## Google Ads KPIs

### KPI-11: Click-Through Rate (CTR)

| Field | Value |
|---|---|
| **Formula** | `ads_campaigns_daily.ctr` (computed column, may be null if impressions = 0) |
| **Source table** | `ads_campaigns_daily` |
| **Update cadence** | Daily (via `ads-sync` Edge Function) |
| **Owner** | Charlie manages campaigns |
| **Unit** | Percentage |

**Thresholds:**
- 🟢 Green: > 3%
- 🟡 Yellow: 2–3%
- 🔴 Red: < 2%

**Uncertainty notes:** CTR can be null when `impressions = 0` (no ad activity). Treat null as 0% for threshold checks. Ads are currently paused (since Apr 13) — no new data until reactivated.

---

### KPI-12: Cost Per Click (CPC)

| Field | Value |
|---|---|
| **Formula** | `ads_campaigns_daily.cpc` (computed column) |
| **Source table** | `ads_campaigns_daily` |
| **Update cadence** | Daily |
| **Owner** | Charlie manages campaigns |
| **Unit** | VND per click |

**Thresholds:**
- 🟢 Green: < 3,000 VND
- 🟡 Yellow: 3,000–5,000 VND
- 🔴 Red: > 5,000 VND

---

## KPI Reliability Matrix

| KPI | Reliability | Known issue |
|---|---|---|
| Daily Revenue (KPI-01) | ✅ High | Cross-check with Sales26 if needed |
| MTD Revenue (KPI-02) | ✅ High | Sum of reliable daily rows |
| Monthly vs Target (KPI-03) | 🟡 Medium | `pnl_monthly` must be entered by Thu — can lag 1–2 weeks |
| Cash Position (KPI-05) | 🟡 Medium | `cash_balance_vnd` = 0 on all rows; use bank balance as proxy |
| Cash Runway (KPI-06) | 🟡 Medium | Fixed costs estimate is approximate (rent/utilities TBD) |
| HR Cost Ratio (KPI-07) | 🟡 Medium | Depends on `pnl_monthly` being entered |
| Bonus Pool (KPI-08) | 🟡 Medium | Requires monthly surplus + Google Review Gate data both present |
| New Reviews (KPI-09) | ✅ High | Auto-synced by Edge Function |
| Google Rating (KPI-10) | ✅ High | Auto-synced by Edge Function |
| CTR / CPC (KPI-11, 12) | 🔴 Currently inactive | Ads paused Apr 13. No new data. |
| Supplier Debt | 🔴 Not yet active | `finance_supplier_debt_weekly` has 0 rows |
