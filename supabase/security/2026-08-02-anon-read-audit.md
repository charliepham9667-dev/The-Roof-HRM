# Anon-key read audit + change-impact analysis

Date: 2026-08-02
Method: unauthenticated PostgREST `SELECT` against every table declared in migrations, using the anon key shipped in the client bundle.
Scope: **reads only**. No writes were attempted against any production database.

---

## Part 1 — HRM project (`gewlgslgltrhnwrsttsm`)

### Why the anon key is not a secret

It ships in the built client bundle: `dist/assets/index-DEFcyOKL.js`, `SyncData-BYQ4saDR.js`, `ScheduleBuilder-d7OXfDv3.js`, `useMarketingSocialMonthly-dgk8lq21.js`. The Customer Care anon key is there too, in `reservationClient-_MIRGz7C.js`. Anyone who opens the dashboard can read both out of the bundle.

### 7 tables readable with no login

| Table | Exposed |
|---|---|
| `pnl_monthly` | 59 cols. Full P&L: gross/net sales, COGS by category, labour incl. salary + insurance + 13th month, fixed costs, opex, EBIT, margins, budgets |
| `reservations` | `customer_name`, `customer_phone`, `customer_email`, date, party size, special requests |
| `daily_metrics` | Daily revenue, pax, avg spend, labour cost, staff on duty, Google rating |
| `delegation_tasks` | Titles, descriptions, assignees, completion notes |
| `shifts` | Staff ids, shift dates, clock in/out |
| `events` | Event calendar incl. unpublished, marketing status |
| `content_calendar` | Unpublished captions, media URLs |

**Held:** `profiles`, `reviews`, `targets`, `compliance_items`, `dj_*`, `employee_leave_summary` return 401 (no anon grant). The remaining ~48 including `employee_banking_details`, `employee_pay_details`, `salary_monthly`, `finance_cash_position_daily` return `200 []` — anon *has* a grant, RLS filtered the rows. Protected by policy logic, not by absence of a grant.

### Root cause

Only `pnl_monthly` is explained by this repo, in `009_pnl_rls_fix.sql`:

```sql
-- Also allow anon to read for public dashboards (if needed)
CREATE POLICY "Public can view P&L data" ON pnl_monthly FOR SELECT TO anon USING (true);
```

All 62 tables have `ENABLE ROW LEVEL SECURITY` in migrations, and every `CREATE POLICY` block was parsed: no other policy is anon-reachable. The other six leaks therefore come from **production drift** — objects changed directly in the SQL editor. Confirmed independently: `salary_monthly` exists in production but its migration is not recorded as applied.

---

## Part 2 — Impact of `20260802000000_revoke_anon_access.sql`

The migration changes privileges of the `anon` role only, re-asserts `ENABLE ROW LEVEL SECURITY` on the 7 tables, and drops the one named policy above. It does not touch `authenticated` or `service_role`.

### Blast radius: every consumer checked

| Consumer | Connects as | Affected |
|---|---|---|
| HRM dashboard, all protected routes | anon key to build the client, then user JWT → `authenticated` | No |
| `/login` | No table queries at all | No |
| `/pending-approval` | `authStore.fetchProfile`, needs `user.id`, post-auth | No |
| Signup | GoTrue + `handle_new_user` trigger, `SECURITY DEFINER` | No |
| 18 of 20 HRM edge functions | `service_role` | No |
| `google-auth`, `google-drive-auth`, `list-sheet-tabs` | No Supabase client | No |
| `employee-documents-drive` | anon key only for `auth.getUser()` on caller JWT (auth schema), then `service_role` | No |
| reservation-system `daily-briefing` | `HRM_SERVICE_ROLE_KEY` | No |
| reservation-system `notify-hrm-booking` | Receives webhook payload, does not query HRM | No |
| AIOS dashboard / finance-os / Northbound OS | Doc and comment references only, no live connection | No |
| Realtime | Zero subscriptions in the codebase | No |
| RPC | Zero `.rpc()` calls in `src` | No |
| Views | None defined in migrations | No |
| Storage buckets | `storage` schema; migration only touches `public` | No |
| RLS helpers `is_owner()`, `is_manager_or_owner()` | Evaluated as `authenticated`. Function EXECUTE was deliberately **not** revoked from `PUBLIC` — doing so would break these and take the whole app down | No |

**Net visible change:** the 7 tables stop answering unauthenticated callers, and future tables no longer auto-grant anon.

### Before applying, know this

1. **`supabase db push` will apply three migrations, not one.** `20260706000000_salary_monthly` and `20260706010000_salary_bonus_check` have been pending since 6 July. Both are fully idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` before each create), so applying them is safe, but it should be a deliberate choice.
2. **A stale second clone exists** at `~/Desktop/the-roof-hrm`: same GitHub repo, last commit 7 June, four migrations behind, and linked to the same production project. Pushing from there would be a mistake. The submodule under `The Roof/5-build/projects/The-Roof-HRM` is current.
3. **Untested.** Docker is not installed, so `supabase start` cannot run and this migration has not executed anywhere.
4. Rollback is one line, at the bottom of the migration.

### What could still bite

Any consumer outside these repos that uses the HRM anon key — a Zapier/n8n scenario, a Framer page, an Apps Script — would break. Nothing of the sort was found in the repos on this machine, but they cannot be ruled out from here.

---

## Part 3 — The Customer Care project is worse, and it is not what it looks like

`reservation-system/supabase/.temp/project-ref` is **`rgjliiwgkvenvpvcklgo`** — the same project that holds the AIOS vault (`os_files`, `os_embeddings`). Customer Care is not a standalone reservation database.

Probed unauthenticated with the public anon key:

| Table | Result |
|---|---|
| `os_files`, `os_embeddings` | `[]` — RLS holding |
| `reservations` | **rows**: name, phone, email, requested_date, requested_time, party_size, special_requests |
| `guests` | **rows**: name, phone, email, nationality, source, tags, notes |
| `conversations` | **rows**: guest_name, phone, channel, status, escalated |
| `messages` | **rows**: sender, body, created_at |
| `ai_chat_sessions` | **rows**: guest_name, messages, state, booking_draft |

The entire guest CRM and the full text of guest conversations are readable by anyone. This anon key is genuinely public by design — the Framer booking form needs it — so there is no bundle to hide behind. This is a larger exposure than the HRM one and it involves personal data of guests rather than internal business figures.

It cannot be fixed the same way. The booking form legitimately needs anon `INSERT` on `reservations`, so a blanket revoke would break the website. It needs per-table treatment: revoke anon everywhere, then grant `INSERT` only on `reservations` plus `SELECT` on `reservation_settings` / `blocked_dates` / `time_slot_caps`, with an RLS `WITH CHECK` policy and no `SELECT` back.

### Bearing on the merge

This kills the earlier framing entirely. "Customer Care is just the reservation sheet" is not accurate: that project holds the AIOS vault, the guest CRM, the inbox, and the AI concierge. Merging it into HRM would move Charlie's entire AIOS vault into the HRM database. The $120/year is not worth that.

---

## Still unverified

- **Write access, anywhere.** A probe with a nonexistent column returns `PGRST204` from the PostgREST schema cache without reaching Postgres, so it proves nothing. Settling it needs a real insert (not run) or SQL-side inspection.
- **`200 []` is ambiguous** — RLS filtering and an empty table look identical from outside, since RLS filters counts too.
- **The SQL-side grant/policy audit never ran.** It needs `psql` (not installed), Docker for `supabase db dump` (not installed), or a Python Postgres driver (none present). Note also that `rls_audit.sql` only inspects 5 tables, so it would not have caught any of this even if it had run in April.
