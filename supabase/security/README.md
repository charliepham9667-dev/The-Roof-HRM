# Supabase Security Audit

Use this folder to verify RLS and grants for security-sensitive tables after migrations.

## Run audit against hosted database

1. Export a Postgres connection string that includes password and SSL mode:

```bash
export DATABASE_URL='postgresql://postgres.<project-ref>:<db-password>@aws-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
```

2. Run the audit:

```bash
./scripts/supabase-rls-audit.sh
```

## What this checks

- RLS status on all `public` tables.
- RLS status and policies for:
  - `profiles`
  - `daily_metrics`
  - `reviews`
  - `compliance_items`
  - `targets`
- Grants for `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- `employee_leave_summary` existence, relation options (including `security_invoker`), and SQL definition.

## Expected baseline for flagged tables

- RLS enabled: `true` on all five tables.
- No broad privileges for `PUBLIC`/`anon`.
- `authenticated` privileges constrained by RLS policies.
- `employee_leave_summary` (if present) should use `security_invoker = true` and avoid `anon`/`PUBLIC` access.
