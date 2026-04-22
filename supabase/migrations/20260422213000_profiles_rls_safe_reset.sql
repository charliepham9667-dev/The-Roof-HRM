-- Force-reset profiles RLS policies to a known-safe baseline.
--
-- Why this exists:
-- Some environments can retain drifted/legacy policies on public.profiles
-- (including policies that call is_owner()/is_manager_or_owner()) and trigger:
--   "infinite recursion detected in policy for relation \"profiles\""
-- even after targeted drops.
--
-- This migration removes all existing policies on public.profiles and then
-- re-creates only the two safe policies the app needs.

-- 1) Remove every existing profiles policy (handles drifted names too).
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', p.policyname);
  END LOOP;
END
$$;

-- 2) Recreate safe baseline policies.
CREATE POLICY "Profiles viewable by all authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3) Keep grants explicit.
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
