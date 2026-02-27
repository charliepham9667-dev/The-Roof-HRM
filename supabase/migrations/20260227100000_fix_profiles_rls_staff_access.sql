-- Fix: Open profiles SELECT to all authenticated users
--
-- Migration 003_role_based_rls.sql replaced the original open policy with:
--   USING (is_owner() OR id = auth.uid())
-- This broke staff/manager access to the profiles table, causing:
--   1. useStaffList() to return only the current user's own row
--   2. Announcement and chat author joins to hang due to recursive RLS evaluation
--      (is_owner() itself queries profiles, creating a recursive RLS call)
--
-- Profiles do not contain sensitive secrets that require row-level isolation.
-- All authenticated users need to read profiles for scheduling, chat, and tasks.

DROP POLICY IF EXISTS "Owner can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Profiles viewable by all authenticated" ON profiles;

CREATE POLICY "Profiles viewable by all authenticated"
  ON profiles FOR SELECT TO authenticated
  USING (true);
