-- Per-vendor supplier debt line items for the Debt Tracker ledger
CREATE TABLE IF NOT EXISTS finance_supplier_debt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('inventory', 'rent', 'capex', 'utilities', 'other')),
  amount_vnd NUMERIC(18, 2) NOT NULL CHECK (amount_vnd >= 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approval', 'approved', 'paid', 'overdue')),
  notes TEXT,
  paid_at DATE,
  source_weekly_report_id UUID REFERENCES finance_supplier_debt_weekly(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_supplier_debt_items_due
  ON finance_supplier_debt_items (due_date ASC);

CREATE INDEX IF NOT EXISTS idx_finance_supplier_debt_items_status
  ON finance_supplier_debt_items (status);

ALTER TABLE finance_supplier_debt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_supplier_debt_items_select" ON finance_supplier_debt_items;
CREATE POLICY "finance_supplier_debt_items_select" ON finance_supplier_debt_items
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

DROP POLICY IF EXISTS "finance_supplier_debt_items_write" ON finance_supplier_debt_items;
CREATE POLICY "finance_supplier_debt_items_write" ON finance_supplier_debt_items
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
