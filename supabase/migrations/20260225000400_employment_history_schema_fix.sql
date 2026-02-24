-- =============================================
-- Fix employment_history table schema
-- Ensures employee_id column exists and schema matches expected structure.
-- Also refreshes PostgREST schema cache (fixes PGRST204 errors).
-- =============================================

-- Drop and recreate to ensure correct schema (fixes schema cache / column mismatch)
DROP TABLE IF EXISTS employment_history CASCADE;

CREATE TABLE employment_history (
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

CREATE INDEX idx_employment_history_employee_id ON employment_history(employee_id);
CREATE INDEX idx_employment_history_start_date ON employment_history(employee_id, start_date DESC);

ALTER TABLE employment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employment history viewable by role"
  ON employment_history FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR is_manager_or_owner());

CREATE POLICY "Employment history insertable by managers"
  ON employment_history FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_owner());

CREATE POLICY "Employment history updatable by managers"
  ON employment_history FOR UPDATE TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

CREATE POLICY "Employment history deletable by managers"
  ON employment_history FOR DELETE TO authenticated
  USING (is_manager_or_owner());

-- Force PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema';
