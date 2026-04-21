-- Daily (or near-daily) cash position snapshot. Accountant sends a screenshot
-- similar to the one in the Operations overview; owner records bank + cash
-- balances here so the Finance Summary can show a trendline and delta.

CREATE TABLE IF NOT EXISTS finance_cash_position_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  bank_balance_vnd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  cash_balance_vnd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_vnd NUMERIC(18, 2) GENERATED ALWAYS AS (
    COALESCE(bank_balance_vnd, 0) + COALESCE(cash_balance_vnd, 0)
  ) STORED,
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

CREATE INDEX IF NOT EXISTS idx_finance_cash_position_daily_date
  ON finance_cash_position_daily (report_date DESC);

ALTER TABLE finance_cash_position_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_cash_position_daily_select" ON finance_cash_position_daily;
CREATE POLICY "finance_cash_position_daily_select" ON finance_cash_position_daily
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

DROP POLICY IF EXISTS "finance_cash_position_daily_write" ON finance_cash_position_daily;
CREATE POLICY "finance_cash_position_daily_write" ON finance_cash_position_daily
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
