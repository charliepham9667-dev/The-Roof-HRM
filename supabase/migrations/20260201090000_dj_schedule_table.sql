-- ============================================================================
-- DJ SCHEDULE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS dj_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  dj_name TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  fee DECIMAL(10, 2),
  notes TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dj_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dj_schedule" ON dj_schedule
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners/managers can manage dj_schedule" ON dj_schedule
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
  ));

CREATE INDEX IF NOT EXISTS idx_dj_schedule_date ON dj_schedule(date);

DROP TRIGGER IF EXISTS update_dj_schedule_updated_at ON dj_schedule;
CREATE TRIGGER update_dj_schedule_updated_at BEFORE UPDATE ON dj_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

