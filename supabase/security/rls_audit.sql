-- Supabase RLS/Grant/View audit report
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/security/rls_audit.sql

\echo '=== RLS status (public schema) ==='
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
ORDER BY c.relname;

\echo '=== Security-sensitive table focus ==='
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relname IN ('profiles', 'daily_metrics', 'reviews', 'compliance_items', 'targets')
ORDER BY c.relname;

\echo '=== Policies on security-sensitive tables ==='
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'daily_metrics', 'reviews', 'compliance_items', 'targets')
ORDER BY tablename, policyname;

\echo '=== Grants for public/anon/authenticated/service_role ==='
SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'daily_metrics', 'reviews', 'compliance_items', 'targets', 'employee_leave_summary')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

\echo '=== employee_leave_summary details (if exists) ==='
SELECT
  n.nspname AS schema_name,
  c.relname AS view_name,
  c.relkind,
  COALESCE(array_to_string(c.reloptions, ', '), '(none)') AS reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'employee_leave_summary';

\echo '=== employee_leave_summary SQL definition (if exists) ==='
SELECT pg_get_viewdef('public.employee_leave_summary'::regclass, true)
WHERE EXISTS (
  SELECT 1
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'employee_leave_summary'
    AND c.relkind IN ('v', 'm')
);
