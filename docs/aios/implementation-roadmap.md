# Implementation Roadmap

*Last updated: 2026-04-22 | 30/60/90-day rollout plan*
*Current state: AIOS 5-layer stack built. Data foundation has gaps. Automation partially live.*

---

## Where We Are Today

**What's working:**
- Daily revenue entry + briefing (manual trigger, reliable)
- Weekly briefing (biweekly cron, reliable)
- Monthly reports (manual, reliable once PnL data is entered)
- All 21 skills built and tested
- Supabase + Notion + Gmail MCPs connected
- Revenue and cashflow CSVs live and accumulating

**What's blocking full automation:**
- `operations_sheet_links` table is empty → Google Sheets integration relies on hardcoded URLs
- `finance_cash_position_daily.cash_balance_vnd` always 0 → cash position understated
- `finance_supplier_debt_weekly` has 0 rows → payment obligations not tracked
- Several CSV files empty: events, partners, HRM snapshots

---

## Phase 1 — Fix the Data Foundation (Days 1–30)

**Goal:** Eliminate empty tables and unreliable inputs. No new features until data is reliable.

### Week 1 (Days 1–7): Critical unblocking

| Task | Owner | Done when |
|---|---|---|
| Insert 4 rows into `operations_sheet_links` (sales, pnl, salary, calendar) | Charlie / developer | AIOS can read Google Sheets without hardcoded URLs |
| Fix `finance_cash_position_daily` entry process with Thu | Charlie | Thu includes cash drawer count daily |
| Thu begins `finance_supplier_debt_weekly` entry every Friday | Charlie → Thu | First Friday row exists |
| Confirm `ads-sync` Edge Function cron schedule in Supabase | Developer | Know when it fires, add to runbook |
| Confirm `sync-google-reviews` Edge Function cadence | Developer | Know how often reviews sync |

**Gate:** Phase 1 Week 2 only starts when `operations_sheet_links` has 4 rows.

### Week 2–3 (Days 8–21): Backfill priority data

| Task | Owner | Done when |
|---|---|---|
| Backfill `event_performance.csv` — top 10 events Jan–Apr 2026 | AIOS + Charlie | 10 event rows in CSV |
| Backfill `partners.csv` — DJ list from `dj_profiles` + dj_payments | AIOS | All 12 DJs listed with status + revenue |
| Correct `marketing_social_monthly_reports` data error (March total_reviews: 1535 vs April: 1353) | Nhi / Charlie | March row shows consistent total_reviews |
| Fix monthly fixed costs estimate for cash runway (get actual rent + utilities from Thu) | Charlie → Thu | KPI-06 formula uses real fixed costs |

### Week 4 (Days 22–30): Verify + stabilize

| Task | Owner | Done when |
|---|---|---|
| Run capability verification checklist (see `aios-capabilities.md`) | Charlie | All 8 checklist items pass |
| Confirm daily briefing + revenue entry runs without manual intervention 5 days in a row | Charlie | No missed entries, no errors |
| Confirm Friday weekly close generates output without data gaps | Charlie | Weekly brief generates in <5 min |

**Phase 1 complete gate:**
- `operations_sheet_links`: 4 rows populated, `csv_export_url` returns 200 ✅
- `finance_cash_position_daily`: cash + bank balance entered daily ✅
- `finance_supplier_debt_weekly`: at least 2 Friday rows ✅
- Capability verification checklist: all green ✅

---

## Phase 2 — Automate the Weekly Loop (Days 31–60)

**Goal:** Daily briefing and weekly close run with zero manual data-entry prompts for 2+ weeks.

### Key tasks

| Task | Owner | Done when |
|---|---|---|
| Update all skills to read Google Sheets via `operations_sheet_links.csv_export_url` (replace hardcoded URLs) | AIOS / developer | No skill has a hardcoded Google Sheets URL |
| Connect `/hrm-revenue-snapshot` to live `pnl_monthly` Supabase data | AIOS | Skill reads DB, not manual paste |
| `finance_supplier_debt_weekly` drives `/expense-dashboard` payment priority list | AIOS | Dashboard shows supplier debt as a line item |
| Monthly social reports workflow: Nhi uploads → AIOS parses → `marketing_social_monthly_reports` updated | Nhi + Charlie | Monthly upload process documented and repeated |
| HRM CSV backfill: `hrm/YYYY_MM_hrm.csv` starts accumulating from `/hrm-revenue-snapshot` | AIOS | At least 1 monthly row in hrm/ folder |

### Process improvements

| Process | Current | Target |
|---|---|---|
| Revenue entry | Charlie pastes screenshot into chat | Screenshot → HRM upload → AIOS reads from `daily_metrics` automatically |
| Weekly briefing | Cron fires biweekly | Cron fires weekly (update schedule if Charlie prefers) |
| Expense tracking | Batch weekly, max 5 BIDV emails | Ideally same day as transaction, 5-at-a-time limit maintained |

**Phase 2 complete gate:**
- Daily briefing runs with 0 data-entry prompts for 14 consecutive days ✅
- Weekly close generates full output in one session without missing data ✅
- Skills use `operations_sheet_links` for all Google Sheets reads ✅

---

## Phase 3 — Intelligence and Proactive Alerting (Days 61–90)

**Goal:** AIOS flags problems before Charlie asks. Zero false-positive alerts for 2 weeks.

### Key tasks

| Task | Owner | Done when |
|---|---|---|
| Cash RED/CRITICAL generates automatic Zalo draft in daily briefing | AIOS | Cash alert fires with draft, no manual trigger needed |
| Revenue streak detection built into daily loop | AIOS | 3-day red streak surfaces in morning briefing automatically |
| HR cost ratio auto-flagged in monthly report if >10% | AIOS | Rule checked every monthly report |
| Bonus calculation fully automated (Charlie approval remains) | AIOS | `/monthly-report` includes bonus calc without manual input |
| Ads monitoring: 3-day no-data gap triggers alert | AIOS | Budget depletion caught automatically |
| Google reviews off-pace triggers Anh Tu Zalo draft in daily briefing | AIOS | Fires when pace_target not met by day 10 of month |

**Phase 3 complete gate:**
- Proactive alerts fire correctly for 2 consecutive weeks with 0 false positives ✅
- Monthly report runs fully automated (only Charlie's 4 qualitative questions needed) ✅
- Bonus calculation generates correctly for at least 1 month ✅

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Thu doesn't maintain `finance_supplier_debt_weekly` weekly | HIGH | MEDIUM | Set Monday HRM reminder for Thu. Charlie checks in weekly review if row exists. |
| `operations_sheet_links` CSV export URLs expire | MEDIUM | HIGH | Monthly URL verification in capability checklist. AIOS flags 403 errors immediately. |
| `ads-sync` Edge Function stops syncing | MEDIUM | MEDIUM | Monitor `ads_campaigns_daily` row count in daily loop. Alert if 3+ day gap during active budget. |
| Bonus calculation error reaches staff | LOW | CRITICAL | Hard requirement: Charlie manually verifies vs HRM before any staff communication. Never auto-send. |
| Supabase MCP permissions change after project upgrade | LOW | HIGH | Keep CSV layer fully functional as fallback. Test MCP monthly. |
| Nhi stops uploading monthly social screenshots | MEDIUM | LOW | Flag in weekly briefing if `marketing_social_monthly_reports` missing for prior month after 7th. |
| Google Sheets OAuth token expires | MEDIUM | HIGH | Covered by `operations_sheet_links` monitoring. Trigger `google-auth` re-auth flow. |
| Charlie unavailable for multi-day stretch | LOW | MEDIUM | All automations continue. Approvals queue up. No staff-facing outputs sent without Charlie. |

---

## Priority Order for Automation

If you can only do one thing at a time, do them in this order:

1. **Populate `operations_sheet_links`** — unblocks Google Sheets reads system-wide
2. **Fix cash balance entry with Thu** — gives accurate cash KPI
3. **Start supplier debt weekly entry** — enables cash runway + payment priority
4. **Backfill event performance** — enables `/event-performance` to generate insight
5. **Backfill partner pipeline** — enables partner-driven event planning
6. **Connect `/hrm-revenue-snapshot` to Supabase** — eliminates manual HRM paste
7. **Proactive alerting rules** — last because alerting is only useful after data is reliable

---

## Quarterly Review Points

At the start of each quarter, before resuming automation:

- [ ] Update `Charlie/quarterly_objectives.md` with new monthly targets
- [ ] Update `Charlie/current-priorities.md` with new focus areas
- [ ] Update `The Roof/3-intelligence/rules.md` if any thresholds change
- [ ] Update `The Roof/1-context/org_chart.md` if team structure changed
- [ ] Re-run capability verification checklist
- [ ] Append quarterly summary to `decisions/log.md`
