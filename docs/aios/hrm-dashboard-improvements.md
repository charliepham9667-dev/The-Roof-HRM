# HRM Dashboard — Audit & Improvement Plan

*Audited: 2026-05-01 | Repo: github.com/charliepham9667-dev/The-Roof-HRM | Live: the-roof-hrm.vercel.app*

---

## What the dashboard currently has

### Owner Dashboard (`/owner/dashboard`)
- Live clock (ICT), venue mode (Club Night / Lounge Day), weather + 7-day forecast
- Automation status strip (system health)
- Quick actions: Log Cash, Log Debt, Open Operations, Open Integrations
- Today's Pulse: team on shift by department, reservations, Google rating, monthly pax MTD
- Revenue tracking: today's revenue (editable), MTD, target, velocity projection
- Week at a Glance: event schedule + DJ assignments
- Task Kanban: 4 columns (Not Started / In Progress / Finish Today / Done)
- Task delegation follow-up panel: last 6 tasks + update age

### Finance section (`/finance/*`)
- Summary → OwnerOverview (live snapshot)
- P&L: revenue mix, expense breakdown, margin gauge, trend chart, CFO executive summary
- Cash flow, cost control, forecast, supplier debt, category drilldown, report builder

### Marketing section (`/marketing/*`)
- Social metrics: Instagram, TikTok, Facebook, Google (followers, engagement, reach)
- Event & DJ pipeline (120-day view), content calendar, weekly promotions
- Partnerships & influencers tracker, brand assets

### People section (`/owner/team-directory`, `/owner/org-chart`, `/owner/workforce`)
- Team Directory: staff cards with department, hours, shift status, hire date
- Org Chart visualization
- Workforce Overview: total/active/on-leave/avg hours stats, department status, activity log

### Other pages
- Weekly Focus (`/weekly-focus`): goal tracking + priority tasks
- Alerts (`/owner/alerts`): critical / warning / info severity tiers
- Ops pages: Staffing, ManagerPerformance, ScheduleBuilder, Reservations, etc.

---

## Critical problems found

### 1. Hardcoded / sample data masquerading as real data

**Alerts page** — all alerts are fake:
- "Server shortage for tonight"
- "Liquor license renewal deadline"
- "Labor cost overages"
These are static mock data, not live from Supabase. The page looks functional but is useless for real decisions.

**Workforce Overview** — shows wrong numbers:
- Displays "24 employees" (The Roof has ~15)
- Shows "Kitchen division" (The Roof has no kitchen)
- Efficiency percentages (88–95%) and activity log appear hardcoded

**Weekly Focus** — shows sample goals:
- "Hitting 800M đ in sales" (real target is 1.5B)
- "Week of Jan 27 – Feb 2, 2026" (frozen in time)
- Goals and tasks are not persisted or synced to real objectives

**Impact:** These three pages create a false picture. If Charlie glances at them, he gets noise, not signal.

---

## Gap analysis — what's missing vs what Charlie needs

### P1 — Affects daily decisions

| Missing | Why it matters | Fix |
|---------|---------------|-----|
| **Bonus tracker** | Surplus Bonus Framework is active since March 2026. Charlie needs MTD revenue → surplus → bonus pool status at a glance. Currently nowhere in the UI. | Add bonus status card to owner dashboard: target vs actual → surplus → 7% pool → Google gate status (4.8★ + 100 reviews gate) |
| **HR cost ratio KPI** | Target <10% of monthly revenue. Not on the main dashboard. The daily_metrics table has this but it's zero-filled and not surfaced. | Add HR cost ratio card next to pax/revenue. Pull from pnl_monthly table. Red/Yellow/Green thresholds already defined in AIOS. |
| **Alerts page — real data** | Current alerts are fake. Real alerts should include: OT cap breach, contract expiry, low review pace, labor cost spike, cash below threshold. | Connect to real Supabase data: clock_records for OT, profiles for contract dates, daily_metrics for revenue/labor flags |

### P2 — Affects weekly management

| Missing | Why it matters | Fix |
|---------|---------------|-----|
| **Contract signed status** | Q2 must-win: all 13 staff 1-year contracts signed. Team Directory shows hire date but not contract status. | Add `contract_signed: boolean` + `contract_end_date` to staff cards in TeamDirectory. Flag unsigned contracts in red. |
| **OT monitoring view** | Thuy approves OT now, but Charlie needs to see if the 2hr/shift cap is being respected. clock_records has 224 rows. | Add OT summary to Workforce or Ops: hours per staff this week, flag anyone approaching/over 2hr/shift cap |
| **Star Staff tracker** | Q2: choose one top performer by end of June. No way to track candidates or scores in the dashboard. | Add a simple Star Staff nomination panel to TeamDirectory or a dedicated section: rate each manager on 4 criteria, see top candidate |
| **Manager KPI scoreboard** | Task completion by Thuy, Phu, Thu, Nhi. delegation_tasks has 11 rows, task_completions only 9. Charlie needs to see this per manager. | Surface completion rate by assignee in the Task Delegation page. Already has `useAllDelegationTasks()` — just add grouping by assignee. |
| **Google reviews bonus gate** | Google Rating card shows the rating and reviews, but doesn't connect to the bonus gate. Charlie needs to see: "100 reviews this month? Y/N — 4.8★? Y/N — Gate: OPEN/LOCKED" | Add a bonus gate status row under the Google Rating card |

### P3 — Nice to have

| Missing | Why it matters | Fix |
|---------|---------------|-----|
| **Inventory module** | `/inventory-intelligence` skill exists but no HRM inventory page. No `useInventory` hook. | Low priority — AIOS skill handles this via file CSVs. Can add later if needed. |
| **GPS clock reliability** | Known 5km drift in clock_records. Attendance data is unreliable. | Either add a manual check-in fallback or disable the GPS requirement. The hook `useClockRecords` exists but the data can't be trusted. |
| **Revenue entry UX** | Today's revenue is "editable" on dashboard but unclear if it writes to Supabase or just local state. | Verify that `useExecutiveDashboardDailyInput` persists correctly to Supabase. |

---

## Quick wins (data already exists — just needs UI)

These require minimal dev work — data is already in Supabase:

1. **HR cost ratio card** — formula: payroll (from org_chart static, ~126.6M/mo) / MTD revenue (from daily_metrics). No new table needed.
2. **Contract status in Team Directory** — add `contract_signed` + `contract_end_date` fields to the profiles table and surface in the staff card.
3. **Bonus gate on Google Rating card** — add two check rows: "100 reviews ✅/❌" and "4.8★ ✅/❌" — data already in `useGoogleReviews()`.
4. **Task completion rate by assignee** — the task delegation hook already fetches all tasks. Add a `.group by assignedTo` grouping in the follow-up panel.
5. **Fix WorkforceOverview** — connect to `useStaffList()` for real staff count and real department names (Bar, Floor, Management, Marketing). Remove Kitchen.

---

## What's working well — keep it

- Owner dashboard core: live clock, revenue velocity, week-at-a-glance, task kanban — solid foundation
- Finance section: P&L, cashflow, supplier debt — comprehensive, real data
- Marketing dashboard: social metrics, DJ pipeline — well-structured
- Team Directory: real staff data, shift status detection — good
- Task delegation Kanban: full CRUD, status tracking, update age — well built
- 40+ Supabase hooks already exist — the data layer is strong

---

## Prioritized build order

### Sprint 1 — Fix the lies (1–2 days)
1. Fix WorkforceOverview: real staff count, real departments, real shift data
2. Fix WeeklyFocus: either connect to real persisted goals or remove the page
3. Fix Alerts: build real alert logic from Supabase (OT, contracts, reviews pace, cash)

### Sprint 2 — Bonus & HR visibility (2–3 days)
4. Add bonus status card to owner dashboard (surplus → pool → gate status)
5. Add HR cost ratio KPI card to owner dashboard
6. Add Google reviews bonus gate status to existing Google Rating card

### Sprint 3 — People management (2–3 days)
7. Add contract status to Team Directory (field + flag unsigned)
8. Add OT monitoring view to Workforce/Ops
9. Add task completion rate by manager to Task Delegation page
10. Add Star Staff candidate tracker to TeamDirectory

---

## Structural notes

**Navigation:** 60+ routes exist but the sidebar structure matters. Recommend grouping by Charlie's actual weekly workflow:
- Daily: Dashboard → Revenue → Tasks
- Weekly: Briefing → Team → Alerts
- Finance: P&L → Cash → Forecast → Debt
- People: Directory → Workforce → Performance
- Marketing: Dashboard → Events → DJ Schedule

**Data quality rule:** Before building more features, fix the three pages with fake data. A dashboard with 60 pages and 3 lying to you is worse than a dashboard with 20 pages that are all accurate.

---

## Manager Dashboard (`/manager/dashboard`)

*Reviewed: 2026-05-01 — file: `src/pages/manager/ManagerDashboard.tsx` (~1700 lines)*

**Overall:** Most KPIs, shifts, tasks, reservations, maintenance, and exec inputs are wired through real Supabase hooks (`useKPISummary`, `useGoogleReviews`, `useTodayShifts`, `useStaffList`, `useAllDelegationTasks`, `useExecutiveDashboardDailyInput`, `useMonthlyTarget`, `useReservationsCsv`, `useRoofCalendarWeekData`, `useMaintenanceTasks`, `useClockIn/Out/Status`). The data layer is good. The problems are concentrated in (a) hardcoded UI that mimics real data, and (b) several genuinely broken interactions.

### P1 — Lies / broken (fix first)

| Issue | Location | Fix |
|-------|----------|-----|
| **Hardcoded weather block** — entire "DA NANG — WEATHER" card is static (27°, "Broken Clouds · Humidity 78%", literal 7-day strip) | `ManagerDashboard.tsx` lines 897–917 | Same fake-data anti-pattern as the three lying owner pages. Either wire to a real weather API (the owner dashboard already has weather; share the source) or remove the card entirely. |
| **Edit dialogs exist but are unreachable** — "Tonight's revenue" and "Monthly pax target" `Dialog` components render but `setTonightEditOpen(true)` / `setPaxTargetEditOpen(true)` are never called anywhere in the file | dialogs lines 1656–1712, no triggers in file | Either wire the pencil/edit buttons to open these dialogs, or remove the dead dialog code. Today the manager has no way to actually edit those values. |
| **Google rating always renders 5 filled stars** regardless of the numeric rating coming from `useGoogleReviews()` | lines 1212–1214 | Render filled stars proportional to rating (e.g. `Math.round(rating)` filled, rest outlined). |

### P2 — Correctness bugs

| Issue | Location | Fix |
|-------|----------|-----|
| `now = new Date()` captured once per render | line 284 | "On shift now" green dot stays wrong until React re-renders for some other reason. Use a 30s `setInterval` that bumps a `tick` state, or move `isOnShiftNow` calls inside a child component that already ticks. |
| `fmtTime(checkInTime)` uses **local timezone** while the rest of the dashboard uses ICT | lines 406–408 | Format the time with `Intl.DateTimeFormat(..., { timeZone: 'Asia/Ho_Chi_Minh' })`. Manager opening the app from outside Vietnam currently sees wrong check-in times. |
| `useTodayPaxConfirmed()` is called and the result discarded (`_csvPaxConfirmed`) | lines 418–420 | Either delete the call or wire it into the pulse card. Dead hook calls trigger unnecessary network requests. |
| `followUpList` builds a `label` field that the JSX never reads (it destructures only `{ task, isFresh }`) | builder lines 617–622, JSX line 1386 | Either render the label or remove it from the builder. |

### P3 — Cleanup

- **Static venue hours string** "Open 14:00 – 02:00" / "Open 14:00 – 01:00" (lines 203–204). Pull from venue settings if/when that table is canonical.
- **Hardcoded promo cheatsheet by weekday** (lines 524–569). Should be the same source of truth as the owner dashboard's promotions; today they can drift independently.
- **Five `ComingSoon` placeholder pages** under `src/pages/manager/`: `Events.tsx`, `Promotions.tsx`, `Incidents.tsx`, `Onboarding.tsx`, `ShiftSummary.tsx`. Either build them or hide the sidebar links; advertising "coming soon" features that never come is its own credibility tax.

### Working well — keep

- Clock in/out flow with photo + geofence — solid
- Maintenance / FloorIssues integration — real CRUD
- Schedule builder — full Supabase-backed CRUD
- Today's pulse cards (when wired correctly) — good UX template

---

## Empty-state convention (project-wide rule)

The reason Alerts, WorkforceOverview, WeeklyFocus, and the manager weather block exist as fake-data pages is the lack of a project convention. **Every data-bound component must:**

1. **Never define module-level mock arrays** (e.g. `const stats = [{ value: '24' }, ...]`). If you don't have data yet, render an empty state, not invented numbers.
2. **Render a visible loading state** (skeleton or spinner) when a hook returns `isLoading`.
3. **Render a visible empty state** ("No data yet" / "Connect Supabase" / "—") when the hook returns 0 rows. Never silently fall through to a "looks fine" UI populated with sample data.
4. **Render a visible error state** when a hook returns `isError` — at least a small banner with retry, never just a blank panel.

Apply this rule going forward. Audit existing components against it as a separate cleanup pass after Sprint 1.

---

*Next step: Share this with the HRM developer. Sprint 1 fixes are highest ROI — they don't add features, they remove noise.*
