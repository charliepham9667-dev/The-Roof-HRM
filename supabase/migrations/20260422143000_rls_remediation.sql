-- =============================================
-- RLS remediation for Security Advisor findings
-- =============================================

-- 1) Ensure RLS is enabled on flagged tables.
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.targets ENABLE ROW LEVEL SECURITY;

-- 2) Remove broad/legacy policies that can accidentally over-permit.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Owner can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Daily metrics viewable by authenticated" ON public.daily_metrics;
DROP POLICY IF EXISTS "Daily metrics insertable by authenticated" ON public.daily_metrics;
DROP POLICY IF EXISTS "Daily metrics updatable by authenticated" ON public.daily_metrics;
DROP POLICY IF EXISTS "Daily metrics writable by owner/manager" ON public.daily_metrics;
DROP POLICY IF EXISTS "Metrics viewable by all authenticated" ON public.daily_metrics;
DROP POLICY IF EXISTS "Metrics manageable by owner" ON public.daily_metrics;

DROP POLICY IF EXISTS "Reviews viewable by authenticated" ON public.reviews;
DROP POLICY IF EXISTS "Reviews insertable by authenticated" ON public.reviews;
DROP POLICY IF EXISTS "Reviews writable by owner/manager" ON public.reviews;
DROP POLICY IF EXISTS "Reviews viewable by all authenticated" ON public.reviews;
DROP POLICY IF EXISTS "Reviews manageable by owner" ON public.reviews;

DROP POLICY IF EXISTS "Compliance viewable by authenticated" ON public.compliance_items;
DROP POLICY IF EXISTS "Compliance insertable by authenticated" ON public.compliance_items;
DROP POLICY IF EXISTS "Compliance updatable by authenticated" ON public.compliance_items;
DROP POLICY IF EXISTS "Compliance writable by owner/manager" ON public.compliance_items;
DROP POLICY IF EXISTS "Compliance viewable by all authenticated" ON public.compliance_items;
DROP POLICY IF EXISTS "Compliance manageable by managers" ON public.compliance_items;

DROP POLICY IF EXISTS "Targets viewable by authenticated" ON public.targets;
DROP POLICY IF EXISTS "Targets insertable by authenticated" ON public.targets;
DROP POLICY IF EXISTS "Targets writable by owner" ON public.targets;
DROP POLICY IF EXISTS "Targets viewable by all authenticated" ON public.targets;
DROP POLICY IF EXISTS "Targets manageable by owner" ON public.targets;

-- 3) Recreate intended baseline policies (fully idempotent — drop the target
--    name first in case an earlier migration or partial run already created it).
DROP POLICY IF EXISTS "Profiles viewable by all authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by all authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Intentionally NOT re-creating "Owner can update any profile" here:
-- is_owner() queries profiles and causes infinite recursion when inlined into
-- a policy on profiles itself. Cross-profile admin writes go through the
-- service role. See migration 20260422210000_fix_profiles_rls_recursion.sql.
DROP POLICY IF EXISTS "Owner can update any profile" ON public.profiles;

DROP POLICY IF EXISTS "Metrics viewable by all authenticated" ON public.daily_metrics;
CREATE POLICY "Metrics viewable by all authenticated"
  ON public.daily_metrics FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Metrics manageable by owner" ON public.daily_metrics;
CREATE POLICY "Metrics manageable by owner"
  ON public.daily_metrics FOR ALL
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

DROP POLICY IF EXISTS "Reviews viewable by all authenticated" ON public.reviews;
CREATE POLICY "Reviews viewable by all authenticated"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Reviews manageable by owner" ON public.reviews;
CREATE POLICY "Reviews manageable by owner"
  ON public.reviews FOR ALL
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

DROP POLICY IF EXISTS "Compliance viewable by all authenticated" ON public.compliance_items;
CREATE POLICY "Compliance viewable by all authenticated"
  ON public.compliance_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Compliance manageable by managers" ON public.compliance_items;
CREATE POLICY "Compliance manageable by managers"
  ON public.compliance_items FOR ALL
  TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

DROP POLICY IF EXISTS "Targets viewable by all authenticated" ON public.targets;
CREATE POLICY "Targets viewable by all authenticated"
  ON public.targets FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Targets manageable by owner" ON public.targets;
CREATE POLICY "Targets manageable by owner"
  ON public.targets FOR ALL
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- 4) Remove broad grants and preserve intended role access.
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.daily_metrics FROM anon;
REVOKE ALL ON TABLE public.reviews FROM anon;
REVOKE ALL ON TABLE public.compliance_items FROM anon;
REVOKE ALL ON TABLE public.targets FROM anon;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.daily_metrics FROM PUBLIC;
REVOKE ALL ON TABLE public.reviews FROM PUBLIC;
REVOKE ALL ON TABLE public.compliance_items FROM PUBLIC;
REVOKE ALL ON TABLE public.targets FROM PUBLIC;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.targets TO authenticated;

GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.daily_metrics TO service_role;
GRANT ALL ON TABLE public.reviews TO service_role;
GRANT ALL ON TABLE public.compliance_items TO service_role;
GRANT ALL ON TABLE public.targets TO service_role;

-- 5) Fix security advisor view finding if object exists in remote project.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'employee_leave_summary'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'ALTER VIEW public.employee_leave_summary SET (security_invoker = true)';
    EXECUTE 'REVOKE ALL ON TABLE public.employee_leave_summary FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.employee_leave_summary FROM PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE public.employee_leave_summary TO authenticated';
  END IF;
END
$$;
