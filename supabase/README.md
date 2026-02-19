# Supabase Setup

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** from Settings > API

## 2. Update Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run Migration

In the Supabase Dashboard:

1. Go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**

This creates:
- `profiles` table (extends auth.users)
- `daily_metrics` table (KPIs)
- `reviews` table (Google/TripAdvisor reviews)
- `compliance_items` table (licenses, permits)
- `shifts` table (staff scheduling)
- `targets` table (monthly goals)
- RLS policies for role-based access

## 4. Seed Development Data

1. Go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `supabase/seed.sql`
4. Click **Run**

This adds sample data for testing the dashboard.

## 5. Create Test User

In Supabase Dashboard:

1. Go to **Authentication** > **Users**
2. Click **Add User** > **Create New User**
3. Enter email/password
4. After creation, go to **Table Editor** > **profiles**
5. Find your user and set `role` to `owner`

## Schema Overview

```
profiles
├── id (UUID, links to auth.users)
├── email
├── full_name
├── role (owner/manager/staff)
├── manager_type (bar/floor/marketing)
└── ...

daily_metrics
├── date (unique)
├── revenue (VND)
├── pax (guest count)
├── avg_spend
├── projected_revenue
└── ...

reviews
├── source (google/tripadvisor/facebook)
├── rating (1-5)
├── comment
├── sentiment_score (0-1)
└── published_at

compliance_items
├── title
├── type (license/permit/certification/audit)
├── status (action_required/needs_attention/passed)
├── due_date
└── ...

shifts
├── staff_id
├── shift_date
├── start_time / end_time
├── role (server/bartender/host)
├── status (scheduled/in_progress/completed)
└── clock_in / clock_out

targets
├── metric (revenue/pax/labor_cost_percentage)
├── target_value
├── period (daily/weekly/monthly)
└── period_start / period_end
```

## RLS Policies

| Table | Read | Write |
|-------|------|-------|
| profiles | All authenticated | Own only |
| daily_metrics | All authenticated | Owner/Manager |
| reviews | All authenticated | Owner/Manager |
| compliance_items | All authenticated | Owner/Manager |
| shifts | Own + Owner/Manager | Owner/Manager |
| targets | All authenticated | Owner only |
