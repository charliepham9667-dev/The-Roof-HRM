-- =============================================
-- Phase 1: Role-Based RLS
-- UP: Add role enum, update profiles, create proper RLS policies
-- =============================================

-- Step 1: Create role enum type (if not exists)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE manager_type AS ENUM ('bar', 'floor', 'marketing');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Add role and manager_type columns to profiles (if not exist)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
  ADD COLUMN IF NOT EXISTS manager_type TEXT CHECK (manager_type IS NULL OR manager_type IN ('bar', 'floor', 'marketing'));

-- Step 3: Create helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 4: Create helper function to check if user is owner
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 5: Create helper function to check if user is manager or owner
CREATE OR REPLACE FUNCTION is_manager_or_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- DROP EXISTING POLICIES (clean slate)
-- =============================================

-- Profiles policies
DROP POLICY IF EXISTS "Profiles viewable by owner" ON profiles;
DROP POLICY IF EXISTS "Profiles viewable by self" ON profiles;
DROP POLICY IF EXISTS "Profiles updatable by self" ON profiles;
DROP POLICY IF EXISTS "Profiles updatable by owner" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Daily metrics policies
DROP POLICY IF EXISTS "Daily metrics viewable by authenticated" ON daily_metrics;
DROP POLICY IF EXISTS "Daily metrics insertable by authenticated" ON daily_metrics;
DROP POLICY IF EXISTS "Daily metrics updatable by authenticated" ON daily_metrics;
DROP POLICY IF EXISTS "Daily metrics viewable by all" ON daily_metrics;
DROP POLICY IF EXISTS "Daily metrics manageable by owner" ON daily_metrics;

-- Reviews policies
DROP POLICY IF EXISTS "Reviews viewable by authenticated" ON reviews;
DROP POLICY IF EXISTS "Reviews insertable by authenticated" ON reviews;
DROP POLICY IF EXISTS "Reviews viewable by all" ON reviews;
DROP POLICY IF EXISTS "Reviews manageable by owner" ON reviews;

-- Compliance policies
DROP POLICY IF EXISTS "Compliance viewable by authenticated" ON compliance_items;
DROP POLICY IF EXISTS "Compliance insertable by authenticated" ON compliance_items;
DROP POLICY IF EXISTS "Compliance updatable by authenticated" ON compliance_items;
DROP POLICY IF EXISTS "Compliance viewable by all" ON compliance_items;
DROP POLICY IF EXISTS "Compliance manageable by managers" ON compliance_items;

-- Shifts policies
DROP POLICY IF EXISTS "Shifts viewable by authenticated" ON shifts;
DROP POLICY IF EXISTS "Shifts insertable by authenticated" ON shifts;
DROP POLICY IF EXISTS "Shifts updatable by authenticated" ON shifts;
DROP POLICY IF EXISTS "Shifts viewable by self" ON shifts;
DROP POLICY IF EXISTS "Shifts viewable by managers" ON shifts;
DROP POLICY IF EXISTS "Shifts manageable by managers" ON shifts;

-- Targets policies
DROP POLICY IF EXISTS "Targets viewable by authenticated" ON targets;
DROP POLICY IF EXISTS "Targets insertable by authenticated" ON targets;
DROP POLICY IF EXISTS "Targets viewable by all" ON targets;
DROP POLICY IF EXISTS "Targets manageable by owner" ON targets;

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES POLICIES
-- =============================================

-- Owner can view all profiles
CREATE POLICY "Owner can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_owner() OR id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Owner can update any profile
CREATE POLICY "Owner can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- =============================================
-- DAILY METRICS POLICIES (read-only for all, write for owner)
-- =============================================

-- All authenticated users can view metrics
CREATE POLICY "Metrics viewable by all authenticated"
  ON daily_metrics FOR SELECT
  TO authenticated
  USING (true);

-- Only owner can insert/update/delete metrics
CREATE POLICY "Metrics manageable by owner"
  ON daily_metrics FOR ALL
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- =============================================
-- REVIEWS POLICIES (read-only for all, write for owner)
-- =============================================

CREATE POLICY "Reviews viewable by all authenticated"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Reviews manageable by owner"
  ON reviews FOR ALL
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- =============================================
-- COMPLIANCE POLICIES (managers and owner can manage)
-- =============================================

CREATE POLICY "Compliance viewable by all authenticated"
  ON compliance_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Compliance manageable by managers"
  ON compliance_items FOR ALL
  TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- =============================================
-- SHIFTS POLICIES (staff see own, managers see all)
-- =============================================

-- Staff can only see their own shifts
-- Managers and owners can see all shifts
CREATE POLICY "Shifts viewable by role"
  ON shifts FOR SELECT
  TO authenticated
  USING (
    is_manager_or_owner() 
    OR staff_id = auth.uid()
  );

-- Only managers and owners can create/update shifts
CREATE POLICY "Shifts manageable by managers"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (is_manager_or_owner());

CREATE POLICY "Shifts updatable by managers or self clockin"
  ON shifts FOR UPDATE
  TO authenticated
  USING (
    is_manager_or_owner() 
    OR (staff_id = auth.uid() AND status IN ('scheduled', 'in_progress'))
  )
  WITH CHECK (
    is_manager_or_owner() 
    OR (staff_id = auth.uid() AND status IN ('scheduled', 'in_progress'))
  );

CREATE POLICY "Shifts deletable by managers"
  ON shifts FOR DELETE
  TO authenticated
  USING (is_manager_or_owner());

-- =============================================
-- TARGETS POLICIES (owner only for writes)
-- =============================================

CREATE POLICY "Targets viewable by all authenticated"
  ON targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Targets manageable by owner"
  ON targets FOR ALL
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- =============================================
-- DOWN (rollback)
-- =============================================
-- To rollback, run:
-- DROP FUNCTION IF EXISTS get_user_role(UUID);
-- DROP FUNCTION IF EXISTS is_owner();
-- DROP FUNCTION IF EXISTS is_manager_or_owner();
-- Then re-run 002_dashboard_tables.sql policies
