# Automation Playbooks

*Last updated: 2026-04-22 | Three operator workflows: daily, Friday weekly close, monthly*

---

## How to Use This Document

Each playbook defines a repeatable workflow. For each:
- **Trigger** = what starts it (cron, event, or manual)
- **Inputs** = what data AIOS needs
- **Validation** = checks before writing anything
- **Actions** = what AIOS does
- **Outputs** = what gets produced
- **Failure handling** = what to do when something goes wrong
- **Human approval points** = where Charlie or a manager must act before AIOS continues

---

## Playbook 1: Daily Revenue Entry

**Cadence:** Every business day, ~11:30AM ICT
**Skill:** `/daily-data-entry`
**Who initiates:** Charlie (paste accountant email/screenshot into AIOS chat)

### Trigger
Accountant email arrives from Thu (~11:30AM) with Excel attachment showing yesterday's or today's revenue split by category + bank balance.

### Inputs
- Revenue by category: cocktails, wine, spirits, shisha, beer, food, other (all in VND)
- Total revenue + total pax
- Bank balance (BIDV)
- Cash on hand (if included)

**Acceptable formats:**
- Screenshot of Excel (pasted as image)
- Copy-pasted text from email
- Typed values ("cocktails 15M, wine 8M...")

### Validation Checks (AIOS runs before writing)
- [ ] `date` = today or yesterday (flag if older)
- [ ] `total_revenue > 0` (never write a 0 revenue day without explicit confirmation)
- [ ] Category sum ≤ gross total (within 2% rounding tolerance)
- [ ] `bank_balance_vnd > 0`
- [ ] No duplicate row for this date in `daily_metrics` (check before insert)

### Actions
1. Parse revenue by category from input
2. Write row to `daily_metrics` (revenue, pax, avg_spend, google_rating if provided)
3. Write row to `finance_cash_position_daily` (bank_balance_vnd, cash_balance_vnd)
4. Append row to `The Roof/2-data/revenue/YYYY_MM_revenue.csv`
5. Append row to `The Roof/2-data/cashflow/YYYY_MM_cashflow.csv`
6. Run intelligence loop: compare vs daily target (50M VND), calculate MTD pace, check Google review count
7. Apply traffic light: 🟢 ≥50M / 🟡 35–49M / 🔴 <35M
8. Update Notion daily briefing page — "💰 Revenue & Cash" section

### Expected Outputs
- Notion daily page: revenue section updated with categories breakdown + traffic light
- 5-line health check: revenue status, MTD pace, cash position, Google reviews pace, any alerts
- CSV files appended (revenue + cashflow)
- No output to staff (this is Charlie-only)

### Failure Handling
| Failure | Action |
|---|---|
| Screenshot unreadable | Ask Charlie to re-paste or type values manually |
| Revenue = 0 | Flag: "Revenue shows 0 — confirm this is correct before writing" |
| Duplicate date detected | Show existing row, ask "replace or skip?" |
| Bank balance missing | Write revenue data, leave cash position row with `notes: "bank balance not provided"` |
| Notion MCP unavailable | Write CSVs, output health check as text in chat |
| Supabase MCP unavailable | Write CSVs only, flag that DB was not updated |

### Human Approval Points
- **Required:** Any field >20% variance from prior 7-day average → AIOS flags and asks "Does this look right?" before writing
- **Required:** Revenue = 0 → always confirm before writing
- **Not required:** Routine entries within expected range → write automatically

---

## Playbook 2: Friday Weekly Close

**Cadence:** Every Friday, ~6PM ICT (or manually via `/weekly-briefing`)
**Skill:** `/weekly-briefing`
**Who initiates:** Auto-cron every 2 weeks (Sunday 9AM), or Charlie manually

### Trigger
- Cron: `0 9 * * 0` (every 2 weeks, Sunday 9AM)
- Manual: Charlie types `/weekly-briefing`

### Inputs
**Auto-loaded (no action from Charlie):**
- `daily_metrics` — last 7 days revenue + pax + reviews
- `finance_cash_position_daily` — last 7 days cash trend
- `ads_campaigns_daily` — last 7 days ads performance
- `events` table — upcoming events next 7 days
- `delegation_tasks` — open tasks by manager
- `profiles` — contract status check

**Charlie answers 4 questions:**
1. Best review or guest moment this week + lesson
2. Review or complaint that needs attention + lesson
3. Operational focus for next week
4. Team focus for next week (staffing, morale, delegation)

### Validation Checks
- [ ] Revenue data present for ≥5 of last 7 days (flag missing dates)
- [ ] Cash position entry exists for at least last 3 days
- [ ] Google reviews count updated (check `daily_metrics.google_review_count` is not stale)
- [ ] Charlie has answered all 4 qualitative questions before generating final output

### Actions
1. Pull and aggregate last 7 days data from Supabase
2. Calculate: WTD revenue, WTD pax, cash trend, review pace, ads performance
3. Check staff contracts: any still unsigned in `profiles`? Flag by name.
4. Check open delegation tasks overdue in `delegation_tasks`
5. Run `/staff-follow-up` logic: route open items to Thuy, Phu, Thu, Nhi
6. Wait for Charlie's 4 qualitative answers
7. Generate Manager Brief HTML (for Thuy, Phu, Thu, Nhi)
8. Generate All-Staff Update HTML (for all staff)
9. Create 2 draft pages in Notion
10. Draft Zalo message per manager (in Vietnamese)

### Expected Outputs
- Manager Brief HTML — revenue performance, ops focus, team acknowledgments, this week's priorities per manager
- All-Staff Update HTML — company performance, recognition, upcoming events, team message
- 2 Notion draft pages (Charlie reviews before sharing)
- 4 Zalo draft messages (Charlie sends manually to each manager)
- Staff follow-up notes: outstanding tasks per manager

### Failure Handling
| Failure | Action |
|---|---|
| Revenue data gap >2 days | Generate partial report, clearly note: "Revenue data missing [dates] — verify with Thu" |
| Charlie doesn't answer questions | Generate data sections, leave qualitative sections as `[PENDING — Charlie's input needed]` |
| Notion MCP unavailable | Output HTML as text blocks in chat for Charlie to copy-paste |
| Staff contracts still unsigned | Include in Manager Brief and Thuy Zalo draft |

### Human Approval Points
- **Required:** Charlie reviews both Notion draft pages before sharing with any manager
- **Required:** Charlie sends Zalo messages manually (AIOS cannot send Zalo)
- **Not required:** Data aggregation and analysis — runs automatically

---

## Playbook 3: Monthly Reporting

**Cadence:** First week of each month, covering prior month
**Skill:** `/monthly-report`
**Who initiates:** Charlie manually runs `/monthly-report`

### Trigger
Manual: Charlie types `/monthly-report` in first week of month.

### Inputs
**Auto-loaded:**
- `The Roof/2-data/revenue/YYYY_MM_revenue.csv` (prior month)
- `The Roof/2-data/cashflow/YYYY_MM_cashflow.csv` (prior month)
- `pnl_monthly` Supabase table (prior month row)
- `daily_metrics` (prior month — for Google reviews)
- `ads_campaigns_daily` (prior month)
- `marketing_social_monthly_reports` (prior month row if exists)
- Monthly target from `quarterly_objectives.md`

**Charlie answers 4 questions:**
1. Biggest win of the month
2. Biggest operational issue or miss
3. Key decision made this month
4. Main focus for next month

### Validation Checks
- [ ] `pnl_monthly` has a row for prior month (if missing, prompt Charlie to add HRM export)
- [ ] Revenue CSV has ≥20 rows for prior month (flag if <20 — suggests missing days)
- [ ] Cash entries exist for ≥20 days of prior month
- [ ] Google reviews count is present for last day of prior month
- [ ] Monthly target for prior month is found in `quarterly_objectives.md`

### Bonus Calculation (included in monthly report)
```
surplus = actual_gross_sales - monthly_target
bonus_pool = surplus × 7%  (only if surplus > 0)

Google Review Gate modifier:
  4.8★+ and 100+ new reviews → 100% payout
  4.7★+ and 70+ new reviews  → 70% payout
  4.6★+ and 35+ new reviews  → 35% payout
  <4.5★                      → 0% (no bonus this month)

Distribution:
  Floor team (service + bar + shisha): 5% of surplus
  Thuy (Floor Manager):                1% of surplus
  Phu (Bar Manager):                   0.5% of surplus
  Thu (Accountant):                    0.5% of surplus
```
**AIOS calculates. Charlie approves before any staff communication.**

### Actions
1. Load all prior month data from CSV layer + Supabase
2. Calculate: gross sales vs target, MTD surplus/shortfall, cash flow (start/end/change), HR cost ratio
3. Calculate bonus eligibility and pool distribution
4. Pull Google reviews count (new reviews for month, rating)
5. Pull ads performance summary (spend, CTR, CPC by campaign)
6. Pull social media metrics from `marketing_social_monthly_reports` if row exists
7. Wait for Charlie's 4 qualitative answers
8. Generate full monthly report Markdown
9. Save to `The Roof/4-automate/reports/monthly/YYYY_MM_report.md`
10. Create Notion monthly summary page

### Expected Outputs
- `The Roof/4-automate/reports/monthly/YYYY_MM_report.md` — full report with all sections
- Notion monthly summary page (draft)
- Bonus calculation table (for Charlie's eyes only until approved)
- Section: wins, issues, decisions, next month focus (from Charlie's answers)

### Failure Handling
| Failure | Action |
|---|---|
| `pnl_monthly` row missing | "PnL row for [month] not found in Supabase. Options: 1) Paste HRM P&L export here, 2) Skip P&L section" |
| Revenue CSV has <20 rows | Note gap: "Revenue data incomplete ([N] days logged of [M] days in month)" — proceed with available data |
| Google reviews count missing | Use `daily_metrics.google_review_count` from last available day of month |
| Social report missing | Skip social section, note: "No marketing_social_monthly_reports row for [month] — ask Nhi to upload" |
| Bonus calculation results in dispute | Never share with staff. Re-run with corrected PnL. Charlie signs off. |

### Human Approval Points
- **Required:** Bonus pool calculation — Charlie verifies numbers match HRM before any mention to staff
- **Required:** Charlie reads full report before Notion page is published
- **Not required:** Data aggregation, trend analysis, draft generation
