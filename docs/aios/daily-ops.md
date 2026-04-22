# Daily Ops — The Roof Operator Cheat Sheet

One page. Read this instead of the full AIOS pack for day-to-day work.
Last updated: 2026-04-22 (COO Simplification pass).

---

## Operating Rule

**Sheets in. Supabase truth. AIOS reads and drafts. Humans approve money, HR, and staff messages.**

If an action does not fit that sentence, it does not ship.

---

## Automation Freeze (2 weeks)

**Start:** 2026-04-22
**End:** 2026-05-06

During the freeze: no new skills, no new edge functions, no new dashboards, no new docs.
Only fix what is failing in the daily loop (sync breaks, bad data, missing approvals).

Anything else goes on a single parking-lot list to review on 2026-05-06.

---

## Daily Loop

### Morning — 5 minutes (MacBook, AIOS)
1. `git pull` in the HRM repo.
2. Run the single AIOS morning brief: *"Run the morning brief."*
3. Read: yesterday KPIs, red flags, drafts awaiting approval, failed syncs.
4. Approve or edit drafts. Do not broadcast anything to staff — paste into Zalo yourself.

### Midday — optional 2 minutes (any device)
- Open HRM owner dashboard. Look only at the **Automation Status** strip.
- All three pills green → move on.
- Any yellow/red → open the relevant surface. Do not investigate randomly.

### End of day — 5 minutes (Mac mini, Cursor or browser)
- Thu logs the day's cash position directly in HRM → **Finance → Summary** (`/finance/summary`). Writes straight to `finance_cash_position_daily`.
- If anything structural changed (migrations, UI), commit and push from Mac mini.

### Friday — 10 minutes
- Thu files the week's supplier debt directly in HRM → **Finance → Debt** (`/finance/debt`). Writes straight to `finance_supplier_debt_weekly`.
- Run AIOS weekly close prompt.
- If end of month, review bonus pool draft (never auto-send).

### Monday — 10 minutes
- Read the RLS / drift audit result (automation status strip shows when it last ran).
- Read the weekly brief. Pick one focus for the week. Write it on one line somewhere visible.

---

## Input Surfaces — one path per data type

| Data | Input surface | Lands in |
|---|---|---|
| Daily revenue + pax | Sales26 "Sales" tab (existing sheet sync) | `daily_metrics` |
| Daily cash position | HRM → `/finance/summary` (direct form) | `finance_cash_position_daily` |
| Weekly supplier debt | HRM → `/finance/debt` (direct form) | `finance_supplier_debt_weekly` |
| Monthly social report | Screenshot upload flow in HRM | `marketing_social_monthly_reports` |
| HR / staff changes | HRM only | `profiles`, `shifts`, etc. |

**Do not invent new inputs** during the freeze. Cash and supplier debt go **directly into the HRM forms** — no Sales26 tab, no CSV export, no sheet sync for these two.

### HRM form expectations

`/finance/summary` — daily cash position. One row per day, upsert on `report_date`.

| Field | Required | Notes |
|---|---|---|
| Report date | ✅ | unique key; default = today |
| Bank balance (VND) | ✅ | total across all bank accounts |
| Cash balance (VND) | ✅ | physical drawer count; 0 is allowed but add a note |
| Notes | optional | short context |
| Source attachment | optional | screenshot / PDF receipt uploaded to `finance-attachments` bucket |

`/finance/debt` — weekly supplier debt. One row per Friday close, upsert on `report_date`.

| Field | Required | Notes |
|---|---|---|
| Report date | ✅ | Friday of the close |
| Total debt (VND) | ✅ | outstanding supplier debt total |
| Total overdue (VND) | optional | must be ≤ total debt |
| Notes | optional | which suppliers, if helpful |
| Source attachment | optional | bank statement / ledger export |

---

## Retired Workflows — stop doing these

- ❌ Pasting daily accountant screenshots into AIOS chat. Thu enters cash position directly in HRM `/finance/summary`.
- ❌ Running cash or supplier debt through a Sales26 sheet tab. HRM is the one input for these.
- ❌ Mirroring data into `The Roof/2-data/*.csv` every day. Supabase is the one truth. CSV mirror is disaster-fallback only.
- ❌ Opening Notion for ops status. Only the HRM owner dashboard.
- ❌ Reading the full `Docs/aios/` pack for daily ops. Use this file.
- ❌ Adding new AIOS skills during the freeze.
- ❌ Schema changes via Supabase SQL editor. Every change goes through a migration in this repo.

---

## Never-do List (permanent)

- AIOS never sends anything directly to staff.
- AIOS never writes to `profiles`, `employee_pay_details`, `employee_banking`, or `hr_documents`.
- AIOS never approves money movements.
- AIOS never runs unreviewed schema changes against production.

---

## Active Skills — top 5 only during the freeze

Everything else is deprioritized until 2026-05-06. Keep using it if it works, but do not invest in fixing it.

1. Morning brief
2. Weekly close (Friday)
3. Monthly bonus pool draft (end of month)
4. RLS / drift audit (weekly Monday)
5. Sheet-sync health check (auto on any red pill)

---

## Columns Not To Trust (hide from UI until repaired)

These live on `daily_metrics` but are zero-filled or derived elsewhere. Do not add new widgets that read from them:

- `daily_metrics.labor_cost` → use `pnl_monthly.labor_cost`
- `daily_metrics.staff_on_duty` → use live shift data
- `daily_metrics.hours_worked` → use shift / clock-in data

---

## Automation Status Strip

Top of the owner dashboard. Three pills:

| Pill | Green means | Yellow means | Red means |
|---|---|---|---|
| Last Sync | < 24h, last run completed | > 24h or still running | last run failed / never ran |
| Last RLS Audit | < 10 days | > 10 days or never | last run failed |
| Open Alerts | 0 | 1–4 unread | 5+ unread |

Red → open the matching surface. Yellow → check at the next natural break. Green → ignore.

---

## When Something Breaks

1. Check the Automation Status strip first.
2. Only then open Supabase logs / Edge Function dashboard.
3. If the daily loop is broken: fall back to manual entry for today, fix tomorrow.
4. Never skip the close on Friday. Manual is allowed; skipping is not.
