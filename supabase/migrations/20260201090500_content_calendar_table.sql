-- ============================================================================
-- CONTENT CALENDAR TABLE
-- Social media content planning
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'all')),
  content_type TEXT CHECK (content_type IN ('post', 'story', 'reel', 'video', 'carousel')),
  caption TEXT,
  media_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'cancelled')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view content_calendar" ON content_calendar
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners/managers can manage content_calendar" ON content_calendar
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
  ));

CREATE INDEX IF NOT EXISTS idx_content_calendar_date ON content_calendar(scheduled_date);

DROP TRIGGER IF EXISTS update_content_calendar_updated_at ON content_calendar;
CREATE TRIGGER update_content_calendar_updated_at BEFORE UPDATE ON content_calendar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

