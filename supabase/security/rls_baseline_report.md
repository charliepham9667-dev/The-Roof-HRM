# RLS Baseline Report

Date: 2026-04-22

## Repository policy baseline (from migrations)

- `profiles`: RLS enabled, readable by authenticated users, update by self or owner.
- `daily_metrics`: RLS enabled, select for authenticated, write restricted to owner.
- `reviews`: RLS enabled, select for authenticated, write restricted to owner.
- `compliance_items`: RLS enabled, select for authenticated, write restricted to manager/owner.
- `targets`: RLS enabled, select for authenticated, write restricted to owner.

Sources:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/003_role_based_rls.sql`
- `supabase/migrations/20260227100000_fix_profiles_rls_staff_access.sql`

## Hosted-project audit status

- Direct hosted introspection from this environment is blocked because `DATABASE_URL`/`SUPABASE_DB_PASSWORD` is not available.
- Audit SQL is prepared at `supabase/security/rls_audit.sql`.
- Run with `./scripts/supabase-rls-audit.sh` after exporting `DATABASE_URL`.

## Drift indicator

- `employee_leave_summary` is not defined in repository migrations.
- If present in hosted DB, it was likely created directly in Supabase SQL editor.
- Remediation migration includes conditional hardening for this view.
