-- =============================================
-- Migration 014: Leave Balances
-- Per-employee balances by leave type.
-- =============================================

CREATE TABLE IF NOT EXISTS leave_balances (
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL
    CHECK (leave_type IN ('annual', 'birthday', 'sick', 'time_in_lieu')),
  balance_days NUMERIC(10,2) NOT NULL DEFAULT 0,
  used_days NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (employee_id, leave_type)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id
  ON leave_balances(employee_id);

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- Read: employee can read own rows; managers/owners can read all.
DROP POLICY IF EXISTS "Leave balances viewable by role" ON leave_balances;
CREATE POLICY "Leave balances viewable by role"
  ON leave_balances FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR is_manager_or_owner());

-- Write: managers/owners only (MVP).
DROP POLICY IF EXISTS "Leave balances insertable by managers" ON leave_balances;
CREATE POLICY "Leave balances insertable by managers"
  ON leave_balances FOR INSERT
  TO authenticated
  WITH CHECK (is_manager_or_owner());

DROP POLICY IF EXISTS "Leave balances updatable by managers" ON leave_balances;
CREATE POLICY "Leave balances updatable by managers"
  ON leave_balances FOR UPDATE
  TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

DROP POLICY IF EXISTS "Leave balances deletable by managers" ON leave_balances;
CREATE POLICY "Leave balances deletable by managers"
  ON leave_balances FOR DELETE
  TO authenticated
  USING (is_manager_or_owner());

