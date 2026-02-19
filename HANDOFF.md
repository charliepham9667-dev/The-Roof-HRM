# The Roof HRM - Phase 1 MVP Handoff

> **Created:** Jan 30, 2026  
> **Purpose:** Context transfer for continuing development on iMac mini

---

## Project Overview

**The Roof Club & Lounge** - Internal HRM web app for F&B business (12 staff, Da Nang, Vietnam)

### Tech Stack
- **Frontend:** Vite + React + TypeScript + Tailwind
- **State:** Zustand (auth), TanStack React Query (server state)
- **Backend:** Supabase (Postgres + RLS + Storage)
- **Auth:** Supabase Auth (email-based, 3 roles: Owner, Manager, Staff)
- **Charts:** Recharts
- **Deployment:** Vercel

---

## What's Already Built

### Database (9 existing + 1 new migration)

| Migration | Tables |
|-----------|--------|
| 001-005 | profiles, daily_metrics, reviews, compliance_items, shifts, targets, sync_logs, app_settings |
| 006-009 | pnl_monthly (comprehensive P&L with revenue/COGS/labor breakdown) |
| **010 (NEW)** | announcements, announcement_reads, announcement_replies, leave_requests, clock_records, venue_settings, reservations, delegation_tasks, task_templates, task_completions, events, event_attendees, promotions, meetings, resource_links, notifications, translations |

### Frontend Components (Existing)
- **Owner Dashboard:** KPICards, WeeklySalesTrend, MonthlyPerformance, RevenueVelocity, ExecutiveSummary, RealTimeStaffing, ServiceReviews, ComplianceAlerts
- **Finance:** PLPerformance, CFOExecutiveSummary, ExpenseBreakdownChart, FinancialKPICards
- **Staffing:** ShiftCalendar, ShiftModal
- **Layout:** DashboardLayout, Header, Sidebar
- **Auth:** Login, RoleGuard, authStore (Zustand)

### New Utilities Created
- `src/lib/formatters.ts` - Currency (848M đ), dates (DD/MM/YYYY), percentages
- `src/lib/geofence.ts` - Haversine distance + browser geolocation for clock-in
- `src/types/index.ts` - Extended with 50+ new TypeScript types

---

## Key Business Decisions (From Charlie)

| Topic | Decision |
|-------|----------|
| Staff Onboarding | Admin creates accounts |
| Job Roles | Bartender, Service, Floor Manager, Receptionist, Host, Videographer, Marketing Manager, Bar Manager, Accountant |
| Operating Hours | Sun-Wed: 14:00-01:00, Fri-Sat: 14:00-02:00 |
| Shift Times | Start 13:30, End 01:30 (02:30 weekends) |
| Labor Targets | FT: 40h/week, PT: 25-30h/week |
| **Stretch Goal** | **25% above base target** |
| Leave Balance | Fixed days per year (default 12) |
| Announcements | Two-way (replies allowed) |
| **Language** | **English + Vietnamese (i18n needed)** |
| Currency Format | Display as "848M đ" |
| Date Format | DD/MM/YYYY (Vietnamese) |
| Timezone | Asia/Ho_Chi_Minh (UTC+7) |
| Google Reviews | Manual update (not API) |
| Calendar | Standalone app calendar (not Google Calendar) |
| Promotions | Informational only (no revenue tracking) |
| Meetings | Include meeting notes feature |
| Reservations | From website form → email → manual entry |
| Reservation Reminders | Yes, needed |

---

## What Needs To Be Built

### Phase 1A: Core Staff Experience (Build First)
| Priority | Feature | Status |
|----------|---------|--------|
| 1 | Clock In/Out (Geo-fenced) | Schema ✅, UI needed |
| 2 | Task Checklists | Schema ✅, seed data ✅, UI needed |
| 3 | Staff Shift View | Partial (ShiftCalendar exists) |
| 4 | Leave Request Form | Schema ✅, UI needed |

### Phase 1B: Manager Operations
| Priority | Feature | Status |
|----------|---------|--------|
| 5 | Manager Dashboard | Not built |
| 6 | Schedule Builder | ShiftModal exists, need weekly view |
| 7 | Reservations CRUD | Schema ✅, UI needed |
| 8 | Leave Approval Queue | Schema ✅, UI needed |
| 9 | Announcements Composer | Schema ✅, UI needed |

### Phase 1C: Owner Features
| Priority | Feature | Status |
|----------|---------|--------|
| 10 | Task Delegation | Schema ✅, UI needed |
| 11 | Team Profiles / Org Chart | Partial (profiles exist) |
| 12 | Calendar & Events | Schema ✅, UI needed |
| 13 | Quick Links Dashboard | Not built |
| 14 | Resource Library | Schema ✅, UI needed |

### Phase 1D: Common Features
| Priority | Feature | Status |
|----------|---------|--------|
| 15 | Announcements Feed + Replies | Schema ✅, UI needed |
| 16 | Notification System | Schema ✅, UI needed |
| 17 | i18n (EN/VI) | translations table ✅, setup needed |

---

## Pending Questions for Charlie

1. **Which feature to build first?**
   - A: Clock-in/out system (most visible staff feature)
   - B: Task checklists (replaces WhatsApp)
   - C: Manager operational dashboard
   - D: Something else?

2. **Run migration 010 now?**
   ```bash
   cd supabase
   supabase db push
   ```
   Or apply manually in Supabase dashboard

3. **Exact coordinates for The Roof?**
   - Current: 16.0544° N, 108.2022° E (approximate)
   - Get exact: Right-click venue in Google Maps → "What's here?"

4. **i18n approach:**
   - Build from start (cleaner, +20% work per component)
   - Or add Vietnamese later?

---

## Seed Data Included (Migration 010)

### Task Templates (6)
1. Bar Opening Checklist (bartender, bar_manager)
2. Service Opening Checklist (service, floor_manager)
3. Bar Closing Checklist (bartender, bar_manager)
4. Service Closing Checklist (service, floor_manager)
5. Mid-Shift Maintenance (all)
6. Shisha Station Prep (bartender, bar_manager)

### Compliance Items (6)
1. Business License Renewal
2. Liquor License Renewal
3. Food Service Permit
4. Fire Safety Certificate
5. Music License (VCPMC)
6. Health Inspection

### Venue Settings
- Name: The Roof Club & Lounge
- Address: 1A Vo Nguyen Giap, Da Nang, Vietnam
- Geofence: 100 meters radius
- Operating hours: Configured per day

---

## File Structure (New/Modified)

```
src/
├── lib/
│   ├── formatters.ts    🆕 Currency, dates, percentages
│   ├── geofence.ts      🆕 Haversine + geolocation
│   └── supabase.ts      ✅ Exists
├── types/
│   └── index.ts         📝 Extended with 50+ types
├── components/
│   ├── manager/         🆕 TO BUILD
│   ├── staff/           🆕 TO BUILD
│   ├── common/          🆕 TO BUILD
│   └── tasks/           🆕 TO BUILD
└── pages/
    ├── manager/         🆕 TO BUILD
    └── common/          🆕 TO BUILD

supabase/migrations/
└── 010_phase1_mvp_complete.sql  🆕 14 tables + RLS + seed data
```

---

## Commands Reference

```bash
# Start dev server
npm run dev

# Apply database migration
cd supabase && supabase db push

# Git (SSH is set up on MacBook Air)
git add -A && git commit -m "message" && git push origin main

# Pull latest on iMac mini
cd ~/Desktop/the-roof-hrm && git pull origin main
```

---

## To Continue Development

**On your iMac mini, open Cursor and start a new conversation with:**

> I'm continuing development on The Roof HRM. Please read HANDOFF.md for full context. I want to build [FEATURE NAME] next. The database migration 010 [has/has not] been applied yet.

---

*This file will be committed to the repo for reference.*
