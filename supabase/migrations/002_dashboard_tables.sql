-- =============================================
-- The Roof HRM - Dashboard Tables Only
-- (Profiles table already exists)
-- =============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- DAILY METRICS (KPIs from Google Sheets)
-- =============================================
CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  revenue BIGINT DEFAULT 0,
  pax INTEGER DEFAULT 0,
  avg_spend BIGINT DEFAULT 0,
  labor_cost BIGINT DEFAULT 0,
  staff_on_duty INTEGER DEFAULT 0,
  hours_scheduled DECIMAL(10,2) DEFAULT 0,
  hours_worked DECIMAL(10,2) DEFAULT 0,
  projected_revenue BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC);

-- =============================================
-- REVIEWS (from Google Places API)
-- =============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL CHECK (source IN ('google', 'tripadvisor', 'facebook', 'internal')),
  author_name TEXT,
  rating DECIMAL(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= 0 AND sentiment_score <= 1),
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_published_at ON reviews(published_at DESC);

-- =============================================
-- COMPLIANCE ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS compliance_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('license', 'permit', 'certification', 'audit', 'training')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('action_required', 'needs_attention', 'passed', 'pending')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_items(status);

-- =============================================
-- SHIFTS (for real-time staffing)
-- =============================================
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'no_show', 'cancelled')),
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff ON shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- =============================================
-- TARGETS (monthly/weekly goals)
-- =============================================
CREATE TABLE IF NOT EXISTS targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric TEXT NOT NULL CHECK (metric IN ('revenue', 'pax', 'labor_cost_percentage', 'avg_spend')),
  target_value BIGINT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;

-- Daily Metrics: Readable by all authenticated
CREATE POLICY "Daily metrics viewable by authenticated"
  ON daily_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Daily metrics insertable by authenticated"
  ON daily_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Daily metrics updatable by authenticated"
  ON daily_metrics FOR UPDATE
  TO authenticated
  USING (true);

-- Reviews: Readable by all authenticated
CREATE POLICY "Reviews viewable by authenticated"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Reviews insertable by authenticated"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Compliance: Readable by all authenticated
CREATE POLICY "Compliance viewable by authenticated"
  ON compliance_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Compliance insertable by authenticated"
  ON compliance_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Compliance updatable by authenticated"
  ON compliance_items FOR UPDATE
  TO authenticated
  USING (true);

-- Shifts: Readable by all authenticated
CREATE POLICY "Shifts viewable by authenticated"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Shifts insertable by authenticated"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Shifts updatable by authenticated"
  ON shifts FOR UPDATE
  TO authenticated
  USING (true);

-- Targets: Readable by all authenticated
CREATE POLICY "Targets viewable by authenticated"
  ON targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Targets insertable by authenticated"
  ON targets FOR INSERT
  TO authenticated
  WITH CHECK (true);
