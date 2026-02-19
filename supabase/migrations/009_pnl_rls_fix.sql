-- Fix RLS policies for pnl_monthly to allow authenticated users to read
-- The app authenticates users, so we can allow all authenticated users to read

-- Drop the restrictive policy if it exists
DROP POLICY IF EXISTS "Owners can view P&L data" ON pnl_monthly;

-- Create a more permissive read policy for authenticated users
CREATE POLICY "Authenticated users can view P&L data"
  ON pnl_monthly FOR SELECT
  TO authenticated
  USING (true);

-- Also allow anon to read for public dashboards (if needed)
CREATE POLICY "Public can view P&L data"
  ON pnl_monthly FOR SELECT
  TO anon
  USING (true);

-- Keep the service role policy for writes
DROP POLICY IF EXISTS "Service role can manage P&L data" ON pnl_monthly;
CREATE POLICY "Service role can manage P&L data"
  ON pnl_monthly FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
