-- =============================================
-- The Roof HRM - Initial Schema
-- =============================================
-- UP Migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES (extends Supabase auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
  manager_type TEXT CHECK (manager_type IN ('bar', 'floor', 'marketing', NULL)),
  avatar_url TEXT,
  phone TEXT,
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- DAILY METRICS (KPIs from Google Sheets)
-- =============================================
CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  revenue BIGINT DEFAULT 0,           -- in VND (smallest unit)
  pax INTEGER DEFAULT 0,              -- number of guests
  avg_spend BIGINT DEFAULT 0,         -- in VND
  labor_cost BIGINT DEFAULT 0,        -- in VND
  staff_on_duty INTEGER DEFAULT 0,
  hours_scheduled DECIMAL(10,2) DEFAULT 0,
  hours_worked DECIMAL(10,2) DEFAULT 0,
  projected_revenue BIGINT DEFAULT 0, -- for trend chart
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date)
);

-- Index for date queries
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

-- Index for recent reviews
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
  staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- if staff-specific (e.g., food handler cert)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for status filtering
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
  role TEXT NOT NULL,  -- 'server', 'bartender', 'host', etc.
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'no_show', 'cancelled')),
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for shift queries
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

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all, but only update their own
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Daily Metrics: Readable by all authenticated, writable by owner/manager
CREATE POLICY "Daily metrics viewable by authenticated"
  ON daily_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Daily metrics writable by owner/manager"
  ON daily_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

-- Reviews: Readable by all authenticated
CREATE POLICY "Reviews viewable by authenticated"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Reviews writable by owner/manager"
  ON reviews FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

-- Compliance: Readable by all, writable by owner/manager
CREATE POLICY "Compliance viewable by authenticated"
  ON compliance_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Compliance writable by owner/manager"
  ON compliance_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

-- Shifts: Staff can see own, managers/owners see all
CREATE POLICY "Staff can view own shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Shifts writable by owner/manager"
  ON shifts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

-- Targets: Readable by all, writable by owner
CREATE POLICY "Targets viewable by authenticated"
  ON targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Targets writable by owner"
  ON targets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

-- =============================================
-- DOWN Migration (for rollback)
-- =============================================
-- To rollback, run:
/*
DROP POLICY IF EXISTS "Targets writable by owner" ON targets;
DROP POLICY IF EXISTS "Targets viewable by authenticated" ON targets;
DROP POLICY IF EXISTS "Shifts writable by owner/manager" ON shifts;
DROP POLICY IF EXISTS "Staff can view own shifts" ON shifts;
DROP POLICY IF EXISTS "Compliance writable by owner/manager" ON compliance_items;
DROP POLICY IF EXISTS "Compliance viewable by authenticated" ON compliance_items;
DROP POLICY IF EXISTS "Reviews writable by owner/manager" ON reviews;
DROP POLICY IF EXISTS "Reviews viewable by authenticated" ON reviews;
DROP POLICY IF EXISTS "Daily metrics writable by owner/manager" ON daily_metrics;
DROP POLICY IF EXISTS "Daily metrics viewable by authenticated" ON daily_metrics;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;

DROP TABLE IF EXISTS targets;
DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS compliance_items;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS daily_metrics;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP TABLE IF EXISTS profiles;
*/
