# AIOS Documentation Pack

*The Roof Da Nang — HRM × AIOS Integration*
*Supabase: `gewlgslgltrhnwrsttsm.supabase.co` | HRM: `the-roof-hrm.vercel.app`*

---

## What This Is

This is the technical and operational documentation for how The Roof's HRM platform integrates with AIOS (Claude Code AI Operating System). It is not generic theory — every file references real tables, real edge functions, real thresholds, and real workflows for this specific system.

Use it when you need to understand how something works, fix something that's broken, onboard a developer, or plan the next phase of automation.

---

## Files in This Pack

| File | When to open it |
|---|---|
| [system-architecture.md](system-architecture.md) | Understanding the full picture — what exists, how data flows, what's broken |
| [aios-capabilities.md](aios-capabilities.md) | What AIOS can and cannot do; MCP tools; hard constraints |
| [automation-playbooks.md](automation-playbooks.md) | Step-by-step: daily revenue, Friday weekly close, monthly reporting |
| [access-and-security.md](access-and-security.md) | What AIOS can write; secrets handling; what never gets auto-output |
| [data-contracts.md](data-contracts.md) | Column-level schema for the 4 key integration tables (with live examples) |
| [integration-map.md](integration-map.md) | Google Sheets, accountant email, Ads, social reports — auth + parse rules |
| [alerts-and-escalation.md](alerts-and-escalation.md) | Every alert threshold, severity, routing, and message template |
| [runbook.md](runbook.md) | Day-1 checklist, failure recovery, backfill procedures |
| [kpi-definitions.md](kpi-definitions.md) | Canonical KPI dictionary — formula, source, threshold, reliability |
| [implementation-roadmap.md](implementation-roadmap.md) | 30/60/90-day plan with phase gates and risk register |

---

## What Charlie Must Fill In First

These are the blockers. Do these before anything else.

### 1. Populate `operations_sheet_links` (CRITICAL — Day 1)

This table is empty. Until it has rows, AIOS cannot auto-read Google Sheets.

**Action:** Insert 4 rows with CSV export URLs for the Sales26 spreadsheet tabs.

How to get a CSV export URL:
1. Open the Sales26 spreadsheet
2. Go to the target tab (Sales, PnL 2026, Salary, or Calendar)
3. File → Share → Publish to web → select the tab → CSV → Copy link

Then insert via AIOS: "Insert these sheet links into operations_sheet_links: [paste the 4 URLs]"

---

### 2. Fix daily cash entry with Thu (HIGH — Week 1)

`finance_cash_position_daily.cash_balance_vnd` is 0 on every row. Thu is only entering the BIDV bank balance. Physical cash in the drawer is not being tracked.

**Action:** Tell Thu to include the cash drawer count in the daily accountant email. Even an approximate figure is better than 0.

---

### 3. Thu starts weekly supplier debt entry (HIGH — Week 1)

`finance_supplier_debt_weekly` has 0 rows. AIOS cannot calculate payment obligations or true cash runway.

**Action:** Every Friday close, Thu enters: total outstanding supplier debt + overdue amount in HRM (or Charlie enters it via AIOS: "Log supplier debt: total 85M, overdue 12M, notes: [details]").

---

### 4. Confirm Edge Function schedules (MEDIUM — Week 1)

Two Edge Functions have unknown cron schedules:
- `ads-sync` — how often does it pull from Google Ads?
- `sync-google-reviews` — how often does it sync reviews?

**Action:** Developer checks Supabase Edge Function scheduler settings. Add to `runbook.md`.

---

### 5. Correct social reports data error (MEDIUM — Week 2)

`marketing_social_monthly_reports` row for March 2026 shows `total_reviews: 1535` but April shows `1353`. Reviews can't decrease. One row has a typo.

**Action:** Ask Nhi for the correct March review count. Update via: "Correct the March 2026 social report: google.total_reviews should be [correct number]"

---

## Suggested Order of Completion

If you're reading this for the first time and don't know where to start:

1. **`system-architecture.md`** — understand the full picture and current gaps
2. **`data-contracts.md`** — understand the 4 key tables (especially `operations_sheet_links`)
3. **`runbook.md`** — run the Day-1 startup checklist
4. **`automation-playbooks.md`** — understand the 3 main workflows
5. **`kpi-definitions.md`** — bookmark for when you need to understand a threshold
6. **`implementation-roadmap.md`** — plan what to fix next
7. **`alerts-and-escalation.md`** — reference when setting up proactive alerting
8. **`integration-map.md`** — reference when debugging a broken integration
9. **`access-and-security.md`** — reference before writing any automation that touches production data
10. **`aios-capabilities.md`** — reference when unsure if AIOS can do something

---

## Quick Reference: Current System State

| Component | Status | Blocker |
|---|---|---|
| Daily revenue entry | ✅ Working | None |
| Weekly briefing | ✅ Working | None |
| Monthly reports | ✅ Working | `pnl_monthly` must be entered by Thu |
| Google Sheets auto-read | 🔴 Blocked | `operations_sheet_links` empty |
| Cash position tracking | 🟡 Partial | `cash_balance_vnd` always 0 |
| Supplier debt tracking | 🔴 Not active | 0 rows in `finance_supplier_debt_weekly` |
| Ads monitoring | 🟡 Paused | Campaigns paused Apr 13 |
| Social reports | 🟡 Partial | 2 months live, needs monthly upload |
| Event performance | 🟡 Empty | CSV needs backfill |
| Partner pipeline | 🟡 Empty | CSV needs backfill |

---

## Key Contacts

| Role | Name | Responsible for |
|---|---|---|
| Founder / AIOS owner | Charlie Pham | All AIOS decisions, bonus approvals, system direction |
| Accountant | Thu | Daily revenue entry, supplier debt, `pnl_monthly` data |
| Floor Manager | Thuy | Staff follow-up, OT approvals |
| Bar Manager | Phu | Inventory counts, bar team |
| Marketing Manager | Nhi | Social reports upload, Google review responses |
| Head of Service | Anh Tu | Google review collection (100/month target) |
