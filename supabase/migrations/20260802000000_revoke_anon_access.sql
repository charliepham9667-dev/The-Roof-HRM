-- Revoke all anon access to the public schema.
--
-- Context: an anon-key audit on 2026-08-02 found 7 tables readable with no
-- login at all, including pnl_monthly (full P&L) and reservations (guest name,
-- phone, email). The HRM anon key is not secret: it ships in the built client
-- bundle, so anyone who opens the dashboard can read it and query the REST API
-- directly. See supabase/security/2026-08-02-anon-read-audit.md.
--
-- Only pnl_monthly's leak is explained by a policy in this repo (009_pnl_rls_fix.sql,
-- "Public can view P&L data"). The other 6 are not, which means production has
-- drifted from these migrations. Dropping policies by name would therefore be
-- guessing at names we cannot see from here.
--
-- Instead this revokes the anon *table grants*. PostgREST cannot read a table the
-- role has no grant on, whatever policies have drifted onto it. This is the
-- backstop that does not depend on knowing prod's current policy state.
--
-- HRM is a login-gated dashboard. It has no legitimate anonymous read path: the
-- app's own queries run as `authenticated` after login, and every server-side
-- consumer (reservation-system daily-briefing, AIOS dashboard, sync functions)
-- uses the service_role key. Nothing here touches authenticated or service_role.

-- 1) Drop the one anon policy we can actually see. -----------------------------
DROP POLICY IF EXISTS "Public can view P&L data" ON public.pnl_monthly;

-- 2) Revoke anon grants across the whole public schema. ------------------------
--    Covers the 7 known leaks and the ~48 tables currently relying on RLS
--    policy logic alone, plus anything created outside these migrations.
REVOKE ALL ON ALL TABLES     IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES  IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS  IN SCHEMA public FROM anon;

--    Same for PUBLIC, which anon inherits from.
REVOKE ALL ON ALL TABLES     IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES  IN SCHEMA public FROM PUBLIC;

--    Schema USAGE is kept. Removing it is not needed once table grants are gone,
--    and keeping it avoids disturbing the auth/login path.

-- 3) Stop the hole reopening on the next new table. ----------------------------
--    Supabase's default privileges hand every future table to anon; without this
--    the next migration silently undoes the fix above.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- 4) Belt and braces: make sure RLS is actually ON for the tables that leaked.
--    All 7 have ENABLE ROW LEVEL SECURITY in this repo already, yet 6 of them
--    leaked anyway, so prod may not match. This re-asserts it idempotently.
--
--    Deliberately ENABLE and not FORCE: FORCE would apply RLS to the table owner
--    too, and migrations run as the owner. A later backfill UPDATE would then
--    match zero rows silently instead of erroring.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pnl_monthly', 'reservations', 'daily_metrics',
    'delegation_tasks', 'shifts', 'events', 'content_calendar'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Rollback, if this breaks something unexpected:
--   GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
-- Then work out which single table actually needed it and grant only that one.
