-- Migration: Google Reviews Integration
-- Adds columns and tables for Google Business Profile API integration

-- Add Google review columns to daily_metrics
ALTER TABLE daily_metrics 
ADD COLUMN IF NOT EXISTS google_rating DECIMAL(2,1),
ADD COLUMN IF NOT EXISTS google_review_count INTEGER DEFAULT 0;

-- Create app_settings table for storing OAuth tokens and other settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only allow service role to access app_settings (contains sensitive tokens)
CREATE POLICY "Service role only" ON app_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Update reviews table to support Google reviews metadata
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index on reviews source for filtering
CREATE INDEX IF NOT EXISTS idx_reviews_source ON reviews(source);
CREATE INDEX IF NOT EXISTS idx_reviews_published_at ON reviews(published_at DESC);

-- Comment on new columns
COMMENT ON COLUMN daily_metrics.google_rating IS 'Average Google review rating for the day (1-5 scale)';
COMMENT ON COLUMN daily_metrics.google_review_count IS 'Cumulative Google review count as of this date';
COMMENT ON TABLE app_settings IS 'Stores application settings including OAuth tokens';
