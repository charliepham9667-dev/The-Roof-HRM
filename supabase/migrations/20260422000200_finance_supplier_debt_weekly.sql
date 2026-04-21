-- Weekly supplier debt snapshot. Owner uploads a screenshot (stored in the
-- finance-attachments bucket) plus key totals every Friday. One row per
-- report_date so uploads for the same week upsert.

CREATE TABLE IF NOT EXISTS finance_supplier_debt_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  total_debt_vnd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_overdue_vnd NUMERIC(18, 2),
  notes TEXT,
  source_file_path TEXT,
  source_file_name TEXT,
  source_file_mime_type TEXT,
  source_file_size_bytes BIGINT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_date)
);

CREATE INDEX IF NOT EXISTS idx_finance_supplier_debt_weekly_date
  ON finance_supplier_debt_weekly (report_date DESC);

ALTER TABLE finance_supplier_debt_weekly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_supplier_debt_weekly_select" ON finance_supplier_debt_weekly;
CREATE POLICY "finance_supplier_debt_weekly_select" ON finance_supplier_debt_weekly
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "finance_supplier_debt_weekly_write" ON finance_supplier_debt_weekly;
CREATE POLICY "finance_supplier_debt_weekly_write" ON finance_supplier_debt_weekly
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  );
