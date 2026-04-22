# Alerts and Escalation

*Last updated: 2026-04-22 | All thresholds sourced from The Roof/3-intelligence/rules.md*

---

## Alert Severity Levels

| Level | Definition | AIOS behavior |
|---|---|---|
| **CRITICAL** | Immediate business risk. Needs Charlie's attention now. | Surface in current session immediately. Include in next morning briefing. |
| **HIGH** | Significant deviation. Needs attention today or tomorrow. | Surface in daily/weekly briefing. Draft Zalo message for Charlie to send. |
| **MEDIUM** | Worth watching. Needs action within the week. | Note in briefing. No proactive Zalo draft unless Charlie asks. |
| **LOW** | Background signal. No immediate action needed. | Log it. Surface in weekly summary. |

---

## Alert Rules

### Revenue Alerts

| Alert | Trigger | Severity | Route to |
|---|---|---|---|
| Revenue GREEN | Daily revenue ≥ 50M VND | INFO | Note in briefing only |
| Revenue YELLOW | Daily revenue 35–49M VND | MEDIUM | Charlie — briefing note |
| Revenue RED | Daily revenue < 35M VND | HIGH | Charlie — Zalo draft |
| Revenue 3-day RED streak | 3+ consecutive days below 35M VND | CRITICAL | Charlie — immediate flag |
| Revenue 3-day GREEN streak | 3+ consecutive days above 50M VND | INFO | Positive note in briefing |
| MTD pace off-track | Actual pace < expected daily cumulative for 7+ consecutive days | HIGH | Charlie — weekly brief |
| Record revenue day | Any single day > 100M VND | INFO | Highlight in briefing |

### Cash Alerts

| Alert | Trigger | Severity | Route to |
|---|---|---|---|
| Cash GREEN | `finance_cash_position_daily.total_vnd` ≥ 500M VND | INFO | Note in briefing |
| Cash YELLOW | 200M–499M VND | HIGH | Charlie — briefing |
| Cash RED | < 200M VND | CRITICAL | Charlie — immediate flag + Thu |
| Single-day drop | `total_vnd` drops > 300M VND vs prior day | HIGH | Charlie + flag Thu |
| Large drop | `total_vnd` drops > 500M VND vs prior day | CRITICAL | Charlie immediate |
| Runway < 2 months | Cash / monthly fixed costs < 2 | CRITICAL | Charlie immediate |

*Monthly fixed costs estimate: ~126.6M VND payroll + ~TBD VND rent/utilities*

### HR and Staff Alerts

| Alert | Trigger | Severity | Route to |
|---|---|---|---|
| HR cost ratio YELLOW | `labor_cost / gross_sales > 10%` | MEDIUM | Charlie |
| HR cost ratio RED | `labor_cost / gross_sales > 12%` | HIGH | Charlie |
| Unsigned contracts | Any `profiles` row with `status = 'pending'` or no linked contract | MEDIUM | Thuy — Zalo draft |
| Probation due | Employee hired >30 days ago with no `employment_history` end date for probation | MEDIUM | Charlie |
| Star Staff due | End of quarter approaching with no Star Staff selection noted | MEDIUM | Charlie |

### Google Reviews Alerts

| Alert | Trigger | Severity | Route to |
|---|---|---|---|
| Reviews off-pace | `new_reviews_mtd < (day_of_month / 30 × 100)` | MEDIUM | Anh Tu — Zalo draft |
| Rating drop | `google_rating < 4.8` | HIGH | Charlie + Nhi |
| Rating critical | `google_rating < 4.5` | CRITICAL | Charlie immediate |
| Unanswered reviews | `marketing_social_monthly_reports.payload.google.unanswered_reviews > 5` | MEDIUM | Nhi — Zalo draft |
| 100 reviews hit | Monthly review count reaches 100 | INFO | Celebrate in briefing |

### Google Ads Alerts

| Alert | Trigger | Severity | Route to |
|---|---|---|---|
| Ads CTR YELLOW | CTR 2–3% | MEDIUM | Charlie |
| Ads CTR RED | CTR < 2% | MEDIUM | Charlie |
| Ads CPC YELLOW | CPC 3,000–5,000 VND | MEDIUM | Charlie |
| Ads CPC RED | CPC > 5,000 VND | MEDIUM | Charlie |
| Budget depleted | No new `ads_campaigns_daily` rows for 3+ days with previously active budget | HIGH | Charlie |
| High spend, no result | Daily spend > 500K VND with CTR < 1% | HIGH | Charlie — pause recommendation |

---

## Escalation Timeline

### CRITICAL
- Raise in current AIOS session immediately
- If raised during a briefing, make it the first item — before anything else
- Include in next morning briefing even if resolved
- Charlie should respond within the same day

### HIGH
- Surface in next daily or weekly briefing
- Draft a Zalo message for the relevant person if action is needed from a manager
- Charlie should act within 24 hours

### MEDIUM
- Include in weekly briefing as a note
- No proactive Zalo draft unless Charlie asks
- Charlie reviews in weekly context

### LOW / INFO
- Log it in the briefing
- No action needed unless pattern continues

---

## Message Templates

### Template 1: Cash Position RED

```
⚠️ Cash Alert — [DATE]

Current position: [X]M VND
Threshold: 200M VND minimum
Status: BELOW threshold

Runway: ~[N] months at current burn rate

Immediate actions:
1. Review payment schedule with Thu — what's due this week?
2. Check supplier debt: [total_debt_vnd from finance_supplier_debt_weekly]
3. Hold any discretionary spend until position recovers

[If runway < 2 months]: This is a critical runway situation. Consider accelerating revenue collection or deferring non-essential payments.
```

### Template 2: Revenue 3-Day Red Streak

```
🔴 3-Day Revenue Warning — [DATE]

[Day 1]: [X]M VND (target: 50M)
[Day 2]: [X]M VND (target: 50M)
[Day 3]: [X]M VND (target: 50M)

All three days below 35M target. MTD: [X]M vs target [Y]M ([Z]% of pace).

Questions to consider:
- Were these weekdays or weekends? (weekday lows are normal; weekend lows are not)
- Any events cancelled or weather issues?
- Marketing push needed? Check upcoming events.

No action needed unless streak continues. Next check: tomorrow's revenue.
```

### Template 3: Google Reviews Off-Pace

```
📊 Reviews Update — [DATE]

This month: [N] new reviews
Pace needed: [M] reviews (day [D] of 30)
Status: [On track / Behind by X reviews]

Rating: [X.X]★ (target: 4.8+)

[If behind]: Zalo draft for Anh Tu:
---
Anh Tu ơi, tháng này chúng ta đang có [N] review mới.
Cần đạt [M] vào cuối tháng.
Nhớ nhắc khách để lại review trước khi rời đi nhé.
Cảm ơn em!
---
```

### Template 4: Unsigned Contracts

```
📋 Contract Status — [DATE]

Staff with pending/unsigned contracts:
[List staff names from profiles]

Action for Thuy:
---
Chị Thủy ơi, các bạn dưới đây chưa ký hợp đồng:
[LIST]
Nhờ chị nhắc các bạn hoàn thành trước [DATE] nhé.
---

[If any staff member has been employed >60 days without a contract: escalate to Charlie immediately]
```

### Template 5: Ads Budget Depleted

```
💸 Google Ads — Budget Depleted

Last campaign activity: [DATE] ([N] days ago)
Last spend: [X] VND/day

Ads are currently paused. No impressions or clicks being generated.

To reactivate:
1. Add budget in Google Ads account
2. Confirm `ads-sync` Edge Function will resume pulling data
3. Check `ads_campaigns_daily` for new rows the next day

Current marketing coverage: organic only (Google Business + social).
```

---

## Alert Suppression Rules

AIOS should NOT alert on these known normal patterns:
- Monday revenue being lower than Friday/Saturday (normal pattern)
- Cash dropping on payroll days (1st and 15th of month typically)
- No `ads_campaigns_daily` rows on days when Charlie has confirmed ads are paused
- Google reviews at 0 for a single day (syncs may lag)
