-- ============================================================================
-- FIX: Content calendar RLS policies
-- The original FOR ALL policy lacked an explicit WITH CHECK clause for writes,
-- and the overlapping SELECT + ALL policies could cause unexpected behavior.
-- This replaces them with explicit, separate policies per operation.
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view content_calendar" ON content_calendar;
DROP POLICY IF EXISTS "Owners/managers can manage content_calendar" ON content_calendar;

-- SELECT: any authenticated user can read
CREATE POLICY "content_calendar_select" ON content_calendar
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: owners and managers only
CREATE POLICY "content_calendar_insert" ON content_calendar
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- UPDATE: owners and managers only
CREATE POLICY "content_calendar_update" ON content_calendar
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- DELETE: owners and managers only
CREATE POLICY "content_calendar_delete" ON content_calendar
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );
