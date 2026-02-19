-- P&L Monthly Data Table
-- Stores monthly P&L aggregates from Google Sheets (PnL 2025/2026)

CREATE TABLE IF NOT EXISTS pnl_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  
  -- Revenue
  gross_sales BIGINT DEFAULT 0,
  discounts BIGINT DEFAULT 0,
  foc BIGINT DEFAULT 0,
  net_sales BIGINT DEFAULT 0,
  service_charge BIGINT DEFAULT 0,
  
  -- Cost of Goods Sold
  cogs BIGINT DEFAULT 0,
  cogs_wine BIGINT DEFAULT 0,
  cogs_spirits BIGINT DEFAULT 0,
  cogs_cocktails BIGINT DEFAULT 0,
  cogs_shisha BIGINT DEFAULT 0,
  cogs_beer BIGINT DEFAULT 0,
  cogs_food BIGINT DEFAULT 0,
  cogs_other BIGINT DEFAULT 0,
  
  -- Labor Costs
  labor_cost BIGINT DEFAULT 0,
  labor_salary BIGINT DEFAULT 0,
  labor_casual BIGINT DEFAULT 0,
  labor_insurance BIGINT DEFAULT 0,
  labor_13th_month BIGINT DEFAULT 0,
  labor_holiday BIGINT DEFAULT 0,
  labor_svc BIGINT DEFAULT 0,
  
  -- Fixed Operating Costs
  fixed_costs BIGINT DEFAULT 0,
  fixed_rental BIGINT DEFAULT 0,
  fixed_utilities BIGINT DEFAULT 0,
  fixed_maintenance BIGINT DEFAULT 0,
  fixed_admin BIGINT DEFAULT 0,
  
  -- Operating Expenses (OPEX)
  opex BIGINT DEFAULT 0,
  opex_consumables BIGINT DEFAULT 0,
  opex_marketing BIGINT DEFAULT 0,
  opex_events BIGINT DEFAULT 0,
  
  -- Reserve Fund
  reserve_fund BIGINT DEFAULT 0,
  
  -- Totals & Profit
  total_expenses BIGINT DEFAULT 0,
  gross_profit BIGINT DEFAULT 0,
  ebit BIGINT DEFAULT 0,
  
  -- Calculated Percentages (stored for quick access)
  cogs_percentage DECIMAL(5,2),
  labor_percentage DECIMAL(5,2),
  gross_margin DECIMAL(5,2),
  ebit_margin DECIMAL(5,2),
  
  -- Budget values (for variance analysis)
  budget_gross_sales BIGINT DEFAULT 0,
  budget_net_sales BIGINT DEFAULT 0,
  budget_cogs BIGINT DEFAULT 0,
  budget_labor BIGINT DEFAULT 0,
  budget_fixed BIGINT DEFAULT 0,
  budget_opex BIGINT DEFAULT 0,
  
  -- Metadata
  data_type VARCHAR(10) DEFAULT 'actual' CHECK (data_type IN ('actual', 'budget')),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one record per year/month/type
  UNIQUE(year, month, data_type)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pnl_year_month ON pnl_monthly(year, month);
CREATE INDEX IF NOT EXISTS idx_pnl_year ON pnl_monthly(year);
CREATE INDEX IF NOT EXISTS idx_pnl_data_type ON pnl_monthly(data_type);

-- Enable RLS
ALTER TABLE pnl_monthly ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only owners can view P&L data
CREATE POLICY "Owners can view P&L data"
  ON pnl_monthly FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

-- Service role can insert/update (for sync functions)
CREATE POLICY "Service role can manage P&L data"
  ON pnl_monthly FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_pnl_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pnl_updated_at
  BEFORE UPDATE ON pnl_monthly
  FOR EACH ROW
  EXECUTE FUNCTION update_pnl_updated_at();

-- Add sync_logs entry type for P&L
-- (sync_logs table should already exist from previous migrations)
COMMENT ON TABLE pnl_monthly IS 'Monthly P&L data synced from Google Sheets (PnL 2025/2026)';
