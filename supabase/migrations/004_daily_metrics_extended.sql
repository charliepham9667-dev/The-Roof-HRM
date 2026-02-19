-- =============================================
-- Phase 3: Extended daily_metrics for Google Sheets sync
-- UP: Add day/night revenue columns, sync metadata
-- =============================================

-- Add new columns to daily_metrics
ALTER TABLE daily_metrics 
  ADD COLUMN IF NOT EXISTS day_revenue BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS night_revenue BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'google_sheets', 'api'));

-- Create index for sync queries
CREATE INDEX IF NOT EXISTS idx_daily_metrics_synced ON daily_metrics(synced_at DESC);

-- Create sync_logs table to track import history
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('google_sheets', 'google_reviews', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

-- RLS for sync_logs (owner only)
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sync logs viewable by owner"
  ON sync_logs FOR SELECT
  TO authenticated
  USING (is_owner());

CREATE POLICY "Sync logs manageable by owner"
  ON sync_logs FOR ALL
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- Function to upsert daily metrics from sheets
CREATE OR REPLACE FUNCTION upsert_daily_metric(
  p_date DATE,
  p_revenue BIGINT,
  p_day_revenue BIGINT,
  p_night_revenue BIGINT,
  p_pax INTEGER,
  p_avg_spend BIGINT
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO daily_metrics (date, revenue, day_revenue, night_revenue, pax, avg_spend, source, synced_at)
  VALUES (p_date, p_revenue, p_day_revenue, p_night_revenue, p_pax, p_avg_spend, 'google_sheets', NOW())
  ON CONFLICT (date) DO UPDATE SET
    revenue = EXCLUDED.revenue,
    day_revenue = EXCLUDED.day_revenue,
    night_revenue = EXCLUDED.night_revenue,
    pax = EXCLUDED.pax,
    avg_spend = EXCLUDED.avg_spend,
    source = 'google_sheets',
    synced_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DOWN (rollback)
-- =============================================
-- ALTER TABLE daily_metrics DROP COLUMN IF EXISTS day_revenue;
-- ALTER TABLE daily_metrics DROP COLUMN IF EXISTS night_revenue;
-- ALTER TABLE daily_metrics DROP COLUMN IF EXISTS synced_at;
-- ALTER TABLE daily_metrics DROP COLUMN IF EXISTS source;
-- DROP TABLE IF EXISTS sync_logs;
-- DROP FUNCTION IF EXISTS upsert_daily_metric;
