# Access and Security

*Last updated: 2026-04-22 | Governs what AIOS can read, write, and never touch*

---

## Data Classification

All data in the HRM system and AIOS is classified into one of four levels.

| Level | Definition | Examples | Who can see |
|---|---|---|---|
| **PUBLIC** | Safe to show in any report or output | Revenue totals, pax counts, Google ratings, event names, weekly schedules | Anyone |
| **INTERNAL** | For management layer only | Daily revenue breakdown by category, cash position, HR cost ratio, bonus pool total | Charlie + managers |
| **CONFIDENTIAL** | Charlie only | Individual staff salaries, supplier debt amounts + overdue, employee pay history, tax records, PnL detail | Charlie only |
| **RESTRICTED** | Never auto-output under any condition | Bank account numbers (`employee_banking`), ID card numbers (`profiles.id_number`), emergency contact details, health information | Charlie only, manually |

**Rule:** When in doubt, classify up. If AIOS is unsure whether to include a field in a report, omit it and note it was withheld.

---

## AIOS Write Scopes

### Free writes (no approval needed)
AIOS can write to these without asking:
- `The Roof/2-data/` CSV files (revenue, cashflow, inventory, events, etc.)
- `The Roof/4-automate/references/` (skill output files)
- `The Roof/4-automate/reports/` (monthly reports)
- `memory/` folder (memory files)
- `decisions/log.md` (append-only)
- Notion daily briefing pages (create/update)
- Notion monthly report pages (create draft)

### Approval required before writing
AIOS must get explicit Charlie approval (in the active conversation) before:
- Any Supabase `INSERT`, `UPDATE`, or `DELETE` on any table
- Any Google Sheets cell edits via MCP
- Notion Finance Tracker entries (expense logging)
- Any file that will be shared with staff or third parties

### Never write (hard stops)
AIOS must never write to:
- `profiles` table (employee records — use HRM app)
- `employee_pay_details` table (salary changes — use HRM app)
- `employee_banking` table (bank details)
- `employee_banking_details` table
- `hr_documents` table (contract files)
- Any table outside the Supabase project
- `.env` files or config files containing secrets

---

## Secrets Handling Policy

| Secret | Where it lives | What AIOS does with it |
|---|---|---|
| Supabase service key | Claude Code MCP config (not in repo) | Used by MCP internally — AIOS never reads or logs it |
| Google Sheets API credentials | Claude Code MCP config | Used by MCP internally |
| Notion API token | Claude Code MCP config | Used by MCP internally |
| Gmail OAuth token | Claude Code MCP config | Used by MCP internally |
| BIDV account numbers | Appear in bank emails | AIOS processes for classification only — never logs raw account numbers to any file |
| Staff ID card numbers | `profiles.id_number` | Never included in any AIOS output or report |

**Rule:** If a secret accidentally appears in a skill output or CSV, delete it before saving. Log the incident in `decisions/log.md`.

**Git safety:** The following should be in `.gitignore` (verify):
- `The Roof/2-data/` (contains business financials)
- `memory/` (contains personal context)
- `decisions/log.md` (contains sensitive decisions)
- Any file matching `*_export.csv` from Revolut or BIDV

---

## Approval-Required Actions Checklist

Before executing any of these, AIOS must confirm with Charlie in the active session:

- [ ] Any SQL statement that modifies more than 1 row in Supabase
- [ ] Any bonus pool number being communicated to staff (even verbally)
- [ ] Any salary figure in any output intended for someone other than Charlie
- [ ] Any new employee record creation in Supabase
- [ ] Any contract generation before the draft is reviewed
- [ ] Any output going to a third party (partners, suppliers, investors)
- [ ] Any financial projection used in investor materials (Mirage fundraise)

---

## Audit Trail Requirements

All significant AIOS actions must be traceable.

| Action type | Where it's logged |
|---|---|
| Skill outputs | Saved to `The Roof/4-automate/references/YYYY-MM-DD_[skill].md` |
| Monthly reports | `The Roof/4-automate/reports/monthly/YYYY_MM_report.md` |
| Significant decisions | `decisions/log.md` (format: `[YYYY-MM-DD] DECISION: ... | REASONING: ... | CONTEXT: ...`) |
| Supabase changes | `employee_audit_trail` table — verify Edge Functions are populating this |
| Expense entries | Notion Finance Tracker (per `/expense-tracker` skill) |

**Review cadence:** Charlie should spot-check `decisions/log.md` monthly.

---

## Incident Response Mini-Runbook

### Incident: Wrong revenue data entered
1. Identify correct values (check accountant email)
2. Update `daily_metrics` row via HRM app (preferred) or Supabase with Charlie approval
3. Re-run `/daily-data-entry` with correct values
4. Correct the corresponding `revenue/YYYY_MM_revenue.csv` row
5. Log in `decisions/log.md`: `[date] DECISION: Corrected revenue for [date] from X to Y | REASONING: Accountant email showed different figure | CONTEXT: Entered via AIOS chat`

### Incident: Bonus calculated incorrectly
1. Stop immediately — do not share any numbers with staff
2. Identify the error (wrong surplus figure, wrong Google gate tier, wrong distribution formula)
3. Pull correct `pnl_monthly.gross_sales` from Supabase
4. Re-run `/business-intelligence` bonus calculation with corrected inputs
5. Charlie verifies against HRM before any staff communication
6. Log in `decisions/log.md`

### Incident: Supabase MCP unavailable
1. AIOS falls back to CSV layer (`The Roof/2-data/`) for all reads
2. Note which data is missing/stale in the session output
3. Continue with available data — clearly label any section that's based on potentially stale data
4. Try again at next session

### Incident: Sensitive data accidentally written to a file
1. Identify the file and the sensitive field
2. Edit/delete the sensitive content immediately
3. If the file was already committed to git: treat as a credential leak — rotate the affected credential, purge git history for that file
4. Log in `decisions/log.md`

### Incident: AIOS output contradicts what Charlie sees in HRM
1. Trust HRM data first
2. Identify the discrepancy source (stale CSV? wrong Supabase query? data entry lag?)
3. Do not proceed with automation until discrepancy is resolved
4. Fix the root cause, not just the output
