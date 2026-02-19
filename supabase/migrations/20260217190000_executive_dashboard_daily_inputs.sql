-- Executive Dashboard manual inputs (owner only)
-- Stores per-day manual fields like Tonight's revenue.

CREATE TABLE IF NOT EXISTS executive_dashboard_daily_inputs (
  date DATE PRIMARY KEY,
  tonights_revenue BIGINT NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE executive_dashboard_daily_inputs ENABLE ROW LEVEL SECURITY;

-- Owner can read/write all rows
DROP POLICY IF EXISTS "Executive dashboard inputs viewable by owner" ON executive_dashboard_daily_inputs;
DROP POLICY IF EXISTS "Executive dashboard inputs manageable by owner" ON executive_dashboard_daily_inputs;

CREATE POLICY "Executive dashboard inputs viewable by owner"
  ON executive_dashboard_daily_inputs FOR SELECT
  TO authenticated
  USING (is_owner());

CREATE POLICY "Executive dashboard inputs manageable by owner"
  ON executive_dashboard_daily_inputs FOR ALL
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- Helpful index for recent lookups (optional)
CREATE INDEX IF NOT EXISTS idx_exec_dashboard_inputs_updated_at
  ON executive_dashboard_daily_inputs(updated_at DESC);

