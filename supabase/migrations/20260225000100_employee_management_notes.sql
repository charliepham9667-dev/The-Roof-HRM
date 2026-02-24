-- Employee management notes: private notes about employees (owner/manager only)
CREATE TABLE IF NOT EXISTS employee_management_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_management_notes_employee_id
  ON employee_management_notes(employee_id);

ALTER TABLE employee_management_notes ENABLE ROW LEVEL SECURITY;

-- Only owner/manager can read and write; staff cannot access
DROP POLICY IF EXISTS "Management notes viewable by owner manager" ON employee_management_notes;
CREATE POLICY "Management notes viewable by owner manager"
  ON employee_management_notes FOR SELECT
  TO authenticated
  USING (is_manager_or_owner());

DROP POLICY IF EXISTS "Management notes insertable by owner manager" ON employee_management_notes;
CREATE POLICY "Management notes insertable by owner manager"
  ON employee_management_notes FOR INSERT
  TO authenticated
  WITH CHECK (is_manager_or_owner());

DROP POLICY IF EXISTS "Management notes deletable by owner manager" ON employee_management_notes;
CREATE POLICY "Management notes deletable by owner manager"
  ON employee_management_notes FOR DELETE
  TO authenticated
  USING (is_manager_or_owner());
