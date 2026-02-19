-- =============================================
-- Migration 013: Employment History
-- Employment Hero-style job description/history rows per employee.
-- =============================================

CREATE TABLE IF NOT EXISTS employment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  industry_job_title TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  employment_type TEXT DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'casual')),
  team TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employment_history_employee_id
  ON employment_history(employee_id);

CREATE INDEX IF NOT EXISTS idx_employment_history_start_date
  ON employment_history(employee_id, start_date DESC);

ALTER TABLE employment_history ENABLE ROW LEVEL SECURITY;

-- Read: employee can read own rows; managers/owners can read all.
DROP POLICY IF EXISTS "Employment history viewable by role" ON employment_history;
CREATE POLICY "Employment history viewable by role"
  ON employment_history FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR is_manager_or_owner());

-- Write: managers/owners only (MVP).
DROP POLICY IF EXISTS "Employment history insertable by managers" ON employment_history;
CREATE POLICY "Employment history insertable by managers"
  ON employment_history FOR INSERT
  TO authenticated
  WITH CHECK (is_manager_or_owner());

DROP POLICY IF EXISTS "Employment history updatable by managers" ON employment_history;
CREATE POLICY "Employment history updatable by managers"
  ON employment_history FOR UPDATE
  TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

DROP POLICY IF EXISTS "Employment history deletable by managers" ON employment_history;
CREATE POLICY "Employment history deletable by managers"
  ON employment_history FOR DELETE
  TO authenticated
  USING (is_manager_or_owner());

