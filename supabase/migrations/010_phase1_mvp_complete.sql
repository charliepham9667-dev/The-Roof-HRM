-- =============================================
-- Migration 010: Phase 1 MVP - Complete Tables
-- The Roof HRM - All missing tables for MVP
-- =============================================

-- =============================================
-- 1. EXTEND PROFILES (add employment type, leave balance)
-- =============================================
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time' 
    CHECK (employment_type IN ('full_time', 'part_time', 'casual')),
  ADD COLUMN IF NOT EXISTS job_role TEXT,
  ADD COLUMN IF NOT EXISTS annual_leave_days INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS leave_days_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_hours_week INTEGER DEFAULT 40;

-- Valid job roles for The Roof
COMMENT ON COLUMN profiles.job_role IS 'Valid roles: bartender, service, floor_manager, receptionist, host, videographer, marketing_manager, bar_manager, accountant';

-- =============================================
-- 2. EXTEND TARGETS (add stretch target)
-- =============================================
ALTER TABLE targets 
  ADD COLUMN IF NOT EXISTS stretch_value BIGINT,
  ADD COLUMN IF NOT EXISTS stretch_percentage INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN targets.stretch_percentage IS 'Percentage above base target for stretch goal (default 25%)';

-- =============================================
-- 3. ANNOUNCEMENTS (with replies support)
-- =============================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Audience: 'all' or specific role
  audience TEXT NOT NULL DEFAULT 'all',
  is_pinned BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  allow_replies BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_audience ON announcements(audience);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active) WHERE is_active = true;

-- Announcement read receipts
CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id);

-- Announcement replies (for discussion threads)
CREATE TABLE IF NOT EXISTS announcement_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_reply_id UUID REFERENCES announcement_replies(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcement_replies_announcement ON announcement_replies(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_replies_parent ON announcement_replies(parent_reply_id);

-- =============================================
-- 4. LEAVE REQUESTS
-- =============================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  leave_type TEXT NOT NULL DEFAULT 'annual' 
    CHECK (leave_type IN ('annual', 'sick', 'personal', 'emergency', 'unpaid', 'maternity', 'paternity')),
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- =============================================
-- 5. CLOCK RECORDS (Geo-fenced)
-- =============================================
-- The Roof location: 1A Vo Nguyen Giap, Da Nang
-- Approximate coordinates: 16.0544° N, 108.2022° E
-- Geo-fence radius: 100 meters

CREATE TABLE IF NOT EXISTS clock_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  clock_type TEXT NOT NULL CHECK (clock_type IN ('in', 'out', 'break_start', 'break_end')),
  clock_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_within_geofence BOOLEAN DEFAULT false,
  distance_from_venue DECIMAL(10, 2),  -- in meters
  device_info TEXT,
  ip_address TEXT,
  notes TEXT,  -- e.g., "Manual override by manager"
  override_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clock_records_staff ON clock_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_clock_records_shift ON clock_records(shift_id);
CREATE INDEX IF NOT EXISTS idx_clock_records_time ON clock_records(clock_time DESC);
-- Note: For date-based queries, use clock_time >= '2024-01-01' AND clock_time < '2024-01-02'

-- Venue location for geo-fencing
CREATE TABLE IF NOT EXISTS venue_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_name TEXT NOT NULL DEFAULT 'The Roof Club & Lounge',
  address TEXT DEFAULT '1A Vo Nguyen Giap, Da Nang, Vietnam',
  latitude DECIMAL(10, 8) DEFAULT 16.054400,
  longitude DECIMAL(11, 8) DEFAULT 108.202200,
  geofence_radius_meters INTEGER DEFAULT 100,
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  -- Operating hours by day (0=Sunday, 6=Saturday)
  operating_hours JSONB DEFAULT '{
    "0": {"open": "14:00", "close": "01:00", "shift_start": "13:30", "shift_end": "01:30"},
    "1": {"open": "14:00", "close": "01:00", "shift_start": "13:30", "shift_end": "01:30"},
    "2": {"open": "14:00", "close": "01:00", "shift_start": "13:30", "shift_end": "01:30"},
    "3": {"open": "14:00", "close": "01:00", "shift_start": "13:30", "shift_end": "01:30"},
    "4": {"open": "14:00", "close": "01:00", "shift_start": "13:30", "shift_end": "01:30"},
    "5": {"open": "14:00", "close": "02:00", "shift_start": "13:30", "shift_end": "02:30"},
    "6": {"open": "14:00", "close": "02:00", "shift_start": "13:30", "shift_end": "02:30"}
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default venue settings
INSERT INTO venue_settings (venue_name) VALUES ('The Roof Club & Lounge')
ON CONFLICT DO NOTHING;

-- =============================================
-- 6. RESERVATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 2,
  table_preference TEXT,  -- e.g., "VIP booth", "Outdoor terrace", "Bar seating"
  special_requests TEXT,  -- e.g., "Birthday celebration", "Anniversary", "Business meeting"
  status TEXT NOT NULL DEFAULT 'confirmed' 
    CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled')),
  source TEXT DEFAULT 'website' 
    CHECK (source IN ('website', 'email', 'phone', 'walk_in', 'social_media')),
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_datetime ON reservations(reservation_date, reservation_time);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_upcoming ON reservations(reservation_date, reservation_time) 
  WHERE status IN ('pending', 'confirmed');

-- =============================================
-- 7. DELEGATION TASKS (Owner → Manager)
-- =============================================
CREATE TABLE IF NOT EXISTS delegation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  due_date DATE,
  due_time TIME,
  priority TEXT NOT NULL DEFAULT 'medium' 
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo' 
    CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled', 'blocked')),
  category TEXT DEFAULT 'general'
    CHECK (category IN ('general', 'operations', 'marketing', 'finance', 'hr', 'maintenance', 'event')),
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delegation_tasks_assigned_to ON delegation_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_delegation_tasks_assigned_by ON delegation_tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_delegation_tasks_status ON delegation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_delegation_tasks_due ON delegation_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_delegation_tasks_priority ON delegation_tasks(priority);

-- =============================================
-- 8. TASK TEMPLATES (Opening/Closing/Mid-shift checklists)
-- =============================================
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,  -- e.g., "Bar Opening Checklist", "Service Closing Checklist"
  description TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('opening', 'closing', 'midshift', 'event', 'special')),
  -- Which role(s) this template applies to
  applicable_roles TEXT[] DEFAULT ARRAY['all'],
  -- Array of task items: [{name, description, order, required, estimated_minutes}]
  tasks JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_templates_type ON task_templates(task_type);
CREATE INDEX IF NOT EXISTS idx_task_templates_active ON task_templates(is_active) WHERE is_active = true;

-- Daily task completions (staff checking off items)
CREATE TABLE IF NOT EXISTS task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Array of completed items: [{task_name, completed_at, notes}]
  completed_tasks JSONB NOT NULL DEFAULT '[]',
  -- Overall completion status
  is_fully_completed BOOLEAN DEFAULT false,
  completion_percentage INTEGER DEFAULT 0,
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, staff_id, completion_date)
);

CREATE INDEX IF NOT EXISTS idx_task_completions_date ON task_completions(completion_date);
CREATE INDEX IF NOT EXISTS idx_task_completions_staff ON task_completions(staff_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_template ON task_completions(template_id);

-- =============================================
-- 9. EVENTS (Company calendar)
-- =============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_vi TEXT,  -- Vietnamese translation
  description TEXT,
  description_vi TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'meeting', 'holiday', 'birthday', 'team_building', 
    'training', 'promotion', 'special_event', 'other'
  )),
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  location TEXT,
  -- For recurring events
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,  -- e.g., "RRULE:FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25" for Christmas
  -- Visual
  color TEXT DEFAULT '#3b82f6',  -- Tailwind blue-500
  icon TEXT,  -- Lucide icon name
  -- Metadata
  related_promotion_id UUID,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active) WHERE is_active = true;

-- Event attendees (for meetings)
CREATE TABLE IF NOT EXISTS event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- =============================================
-- 10. PROMOTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_vi TEXT,
  description TEXT,
  description_vi TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  -- Targeting
  target_audience TEXT DEFAULT 'all',
  -- Discount details (informational only per user request)
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'bogo', 'bundle', 'other')),
  discount_value DECIMAL(10, 2),
  discount_description TEXT,
  -- Visual
  image_url TEXT,
  color TEXT DEFAULT '#10b981',  -- Tailwind emerald-500
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'ended')),
  is_active BOOLEAN DEFAULT true,
  -- Metadata
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active) WHERE is_active = true;

-- =============================================
-- 11. MEETINGS
-- =============================================
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  agenda TEXT,
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  location TEXT DEFAULT 'The Roof Office',
  -- Attendees stored in event_attendees via linked event
  linked_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  -- Meeting notes (optional feature)
  notes TEXT,
  notes_updated_at TIMESTAMPTZ,
  notes_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Action items from meeting
  action_items JSONB DEFAULT '[]',  -- [{task, assignee_id, due_date, status}]
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' 
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- =============================================
-- 12. RESOURCE LINKS (SOPs, Training, etc.)
-- =============================================
CREATE TABLE IF NOT EXISTS resource_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_vi TEXT,
  description TEXT,
  description_vi TEXT,
  url TEXT NOT NULL,  -- Google Drive link
  category TEXT NOT NULL CHECK (category IN (
    'sop', 'training', 'safety', 'branding', 'hr', 
    'menu', 'recipes', 'licenses', 'other'
  )),
  subcategory TEXT,  -- e.g., "Bartender SOPs", "Server Training"
  icon TEXT DEFAULT 'file-text',  -- Lucide icon name
  -- For license documents - link to compliance item
  compliance_item_id UUID REFERENCES compliance_items(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_links_category ON resource_links(category);
CREATE INDEX IF NOT EXISTS idx_resource_links_compliance ON resource_links(compliance_item_id);

-- =============================================
-- 13. NOTIFICATIONS (for reminders, alerts)
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_vi TEXT,
  body TEXT,
  body_vi TEXT,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'shift_reminder', 'reservation_reminder', 'leave_status', 
    'task_assigned', 'task_due', 'announcement', 'compliance_alert',
    'clock_reminder', 'meeting_reminder', 'general'
  )),
  -- Link to related entity
  related_type TEXT,  -- e.g., 'shift', 'reservation', 'task'
  related_id UUID,
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for) WHERE is_sent = false;

-- =============================================
-- 14. I18N TRANSLATIONS (for dynamic content)
-- =============================================
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,  -- e.g., "task_template.bar_opening"
  locale TEXT NOT NULL CHECK (locale IN ('en', 'vi')),
  value TEXT NOT NULL,
  context TEXT,  -- e.g., "Used in task templates"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key, locale)
);

CREATE INDEX IF NOT EXISTS idx_translations_key ON translations(key);
CREATE INDEX IF NOT EXISTS idx_translations_locale ON translations(locale);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Announcements viewable by all authenticated"
  ON announcements FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Announcements manageable by managers"
  ON announcements FOR ALL TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Announcement reads
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reads viewable by all authenticated"
  ON announcement_reads FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can mark announcements as read"
  ON announcement_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Announcement replies
ALTER TABLE announcement_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Replies viewable by all authenticated"
  ON announcement_replies FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Users can create replies"
  ON announcement_replies FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can edit own replies"
  ON announcement_replies FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Leave requests
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leave requests viewable by role"
  ON leave_requests FOR SELECT TO authenticated
  USING (staff_id = auth.uid() OR is_manager_or_owner());

CREATE POLICY "Staff can create leave requests"
  ON leave_requests FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Staff can cancel own pending requests"
  ON leave_requests FOR UPDATE TO authenticated
  USING (staff_id = auth.uid() AND status = 'pending')
  WITH CHECK (staff_id = auth.uid() AND status = 'cancelled');

CREATE POLICY "Managers can review leave requests"
  ON leave_requests FOR UPDATE TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Clock records
ALTER TABLE clock_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clock records viewable by role"
  ON clock_records FOR SELECT TO authenticated
  USING (staff_id = auth.uid() OR is_manager_or_owner());

CREATE POLICY "Staff can clock in/out"
  ON clock_records FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid() OR is_manager_or_owner());

-- Venue settings
ALTER TABLE venue_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue settings viewable by all"
  ON venue_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Venue settings manageable by owner"
  ON venue_settings FOR ALL TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- Reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reservations viewable by all authenticated"
  ON reservations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Reservations manageable by managers"
  ON reservations FOR ALL TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Delegation tasks
ALTER TABLE delegation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks viewable by involved parties"
  ON delegation_tasks FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR assigned_by = auth.uid() OR is_owner());

CREATE POLICY "Owner can create tasks"
  ON delegation_tasks FOR INSERT TO authenticated
  WITH CHECK (is_owner());

CREATE POLICY "Assignee can update task status"
  ON delegation_tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR assigned_by = auth.uid() OR is_owner());

CREATE POLICY "Owner can delete tasks"
  ON delegation_tasks FOR DELETE TO authenticated
  USING (is_owner());

-- Task templates
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates viewable by all authenticated"
  ON task_templates FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Templates manageable by managers"
  ON task_templates FOR ALL TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Task completions
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Completions viewable by role"
  ON task_completions FOR SELECT TO authenticated
  USING (staff_id = auth.uid() OR is_manager_or_owner());

CREATE POLICY "Staff can complete tasks"
  ON task_completions FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Staff can update own completions"
  ON task_completions FOR UPDATE TO authenticated
  USING (staff_id = auth.uid());

-- Events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events viewable by all authenticated"
  ON events FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Events manageable by managers"
  ON events FOR ALL TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Event attendees
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendees viewable by all authenticated"
  ON event_attendees FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can respond to own attendance"
  ON event_attendees FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can manage attendees"
  ON event_attendees FOR ALL TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Promotions
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promotions viewable by all authenticated"
  ON promotions FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Promotions manageable by managers"
  ON promotions FOR ALL TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meetings viewable by all authenticated"
  ON meetings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Meetings manageable by managers"
  ON meetings FOR ALL TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Resource links
ALTER TABLE resource_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resources viewable by all authenticated"
  ON resource_links FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Resources manageable by owner"
  ON resource_links FOR ALL TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Translations
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Translations viewable by all"
  ON translations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Translations manageable by owner"
  ON translations FOR ALL TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Calculate distance between two coordinates (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 DECIMAL, lon1 DECIMAL,
  lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  R DECIMAL := 6371000; -- Earth radius in meters
  phi1 DECIMAL;
  phi2 DECIMAL;
  delta_phi DECIMAL;
  delta_lambda DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  phi1 := radians(lat1);
  phi2 := radians(lat2);
  delta_phi := radians(lat2 - lat1);
  delta_lambda := radians(lon2 - lon1);
  
  a := sin(delta_phi / 2) * sin(delta_phi / 2) +
       cos(phi1) * cos(phi2) *
       sin(delta_lambda / 2) * sin(delta_lambda / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if coordinates are within venue geofence
CREATE OR REPLACE FUNCTION is_within_geofence(
  lat DECIMAL, lon DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  venue RECORD;
  distance DECIMAL;
BEGIN
  SELECT * INTO venue FROM venue_settings LIMIT 1;
  
  IF venue IS NULL THEN
    RETURN false;
  END IF;
  
  distance := calculate_distance_meters(lat, lon, venue.latitude, venue.longitude);
  
  RETURN distance <= venue.geofence_radius_meters;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get today's reservations
CREATE OR REPLACE FUNCTION get_todays_reservations()
RETURNS SETOF reservations AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM reservations
  WHERE reservation_date = CURRENT_DATE
    AND status IN ('pending', 'confirmed', 'seated')
  ORDER BY reservation_time;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get upcoming reservations needing reminders
CREATE OR REPLACE FUNCTION get_reservations_for_reminder(hours_ahead INTEGER DEFAULT 2)
RETURNS SETOF reservations AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM reservations
  WHERE reservation_date = CURRENT_DATE
    AND status = 'confirmed'
    AND reminder_sent = false
    AND (reservation_date + reservation_time) <= (NOW() + (hours_ahead || ' hours')::INTERVAL)
    AND (reservation_date + reservation_time) > NOW();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Trigger to auto-calculate leave days
CREATE OR REPLACE FUNCTION calculate_leave_days()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_days := (NEW.end_date - NEW.start_date) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_leave_days
  BEFORE INSERT OR UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION calculate_leave_days();

-- Trigger to update leave_days_used when leave is approved
CREATE OR REPLACE FUNCTION update_leave_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- When leave is approved, increment used days
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE profiles
    SET leave_days_used = leave_days_used + NEW.total_days
    WHERE id = NEW.staff_id;
  END IF;
  
  -- When approved leave is cancelled, decrement used days
  IF NEW.status = 'cancelled' AND OLD.status = 'approved' THEN
    UPDATE profiles
    SET leave_days_used = GREATEST(0, leave_days_used - OLD.total_days)
    WHERE id = NEW.staff_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_leave_balance
  AFTER UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance();

-- =============================================
-- SEED DATA: Task Templates
-- =============================================

-- Bar Opening Checklist
INSERT INTO task_templates (name, task_type, applicable_roles, tasks)
VALUES (
  'Bar Opening Checklist',
  'opening',
  ARRAY['bartender', 'bar_manager'],
  '[
    {"name": "Check ice machine and stock ice bins", "order": 1, "required": true, "estimated_minutes": 5},
    {"name": "Restock all liquor bottles from storage", "order": 2, "required": true, "estimated_minutes": 10},
    {"name": "Prepare fresh garnishes (lime, lemon, mint)", "order": 3, "required": true, "estimated_minutes": 15},
    {"name": "Check and refill mixers and sodas", "order": 4, "required": true, "estimated_minutes": 5},
    {"name": "Clean and polish glassware", "order": 5, "required": true, "estimated_minutes": 10},
    {"name": "Set up bar mats and tools", "order": 6, "required": true, "estimated_minutes": 5},
    {"name": "Turn on bar lights and music", "order": 7, "required": true, "estimated_minutes": 2},
    {"name": "Check POS system is working", "order": 8, "required": true, "estimated_minutes": 2}
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- Service Opening Checklist
INSERT INTO task_templates (name, task_type, applicable_roles, tasks)
VALUES (
  'Service Opening Checklist',
  'opening',
  ARRAY['service', 'floor_manager'],
  '[
    {"name": "Set up all tables with menus and napkins", "order": 1, "required": true, "estimated_minutes": 15},
    {"name": "Check all table candles and replace if needed", "order": 2, "required": true, "estimated_minutes": 5},
    {"name": "Ensure all chairs are clean and positioned", "order": 3, "required": true, "estimated_minutes": 5},
    {"name": "Turn on terrace lights and fans", "order": 4, "required": true, "estimated_minutes": 2},
    {"name": "Check reservation list for tonight", "order": 5, "required": true, "estimated_minutes": 5},
    {"name": "Stock service station (straws, napkins, toothpicks)", "order": 6, "required": true, "estimated_minutes": 5},
    {"name": "Review daily specials and promotions", "order": 7, "required": true, "estimated_minutes": 5}
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- Bar Closing Checklist
INSERT INTO task_templates (name, task_type, applicable_roles, tasks)
VALUES (
  'Bar Closing Checklist',
  'closing',
  ARRAY['bartender', 'bar_manager'],
  '[
    {"name": "Clean and sanitize all bar surfaces", "order": 1, "required": true, "estimated_minutes": 10},
    {"name": "Wash and store all glassware", "order": 2, "required": true, "estimated_minutes": 15},
    {"name": "Empty and clean ice bins", "order": 3, "required": true, "estimated_minutes": 5},
    {"name": "Store all perishable garnishes in fridge", "order": 4, "required": true, "estimated_minutes": 5},
    {"name": "Count and record liquor inventory", "order": 5, "required": true, "estimated_minutes": 10},
    {"name": "Clean and organize speed rails", "order": 6, "required": true, "estimated_minutes": 5},
    {"name": "Take out trash and replace bin liners", "order": 7, "required": true, "estimated_minutes": 5},
    {"name": "Turn off all bar equipment", "order": 8, "required": true, "estimated_minutes": 2}
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- Service Closing Checklist
INSERT INTO task_templates (name, task_type, applicable_roles, tasks)
VALUES (
  'Service Closing Checklist',
  'closing',
  ARRAY['service', 'floor_manager'],
  '[
    {"name": "Clear and clean all tables", "order": 1, "required": true, "estimated_minutes": 15},
    {"name": "Return all menus to storage", "order": 2, "required": true, "estimated_minutes": 5},
    {"name": "Blow out all candles safely", "order": 3, "required": true, "estimated_minutes": 3},
    {"name": "Stack chairs on tables for cleaning", "order": 4, "required": true, "estimated_minutes": 10},
    {"name": "Restock service station for tomorrow", "order": 5, "required": true, "estimated_minutes": 5},
    {"name": "Turn off terrace lights and fans", "order": 6, "required": true, "estimated_minutes": 2},
    {"name": "Report any damaged items to manager", "order": 7, "required": false, "estimated_minutes": 2}
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- Mid-Shift Tasks
INSERT INTO task_templates (name, task_type, applicable_roles, tasks)
VALUES (
  'Mid-Shift Maintenance',
  'midshift',
  ARRAY['all'],
  '[
    {"name": "Water all plants on terrace", "order": 1, "required": true, "estimated_minutes": 10},
    {"name": "Restock paper supplies in restrooms", "order": 2, "required": true, "estimated_minutes": 5},
    {"name": "Check and empty trash if full", "order": 3, "required": true, "estimated_minutes": 5},
    {"name": "Wipe down high-touch surfaces", "order": 4, "required": true, "estimated_minutes": 5},
    {"name": "Check ice levels at bar", "order": 5, "required": true, "estimated_minutes": 2}
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- Shisha Prep (Event/Special)
INSERT INTO task_templates (name, task_type, applicable_roles, tasks)
VALUES (
  'Shisha Station Prep',
  'event',
  ARRAY['bartender', 'bar_manager'],
  '[
    {"name": "Check shisha inventory levels", "order": 1, "required": true, "estimated_minutes": 5},
    {"name": "Clean all shisha pipes and bowls", "order": 2, "required": true, "estimated_minutes": 15},
    {"name": "Prepare charcoal station", "order": 3, "required": true, "estimated_minutes": 10},
    {"name": "Set up shisha menu cards", "order": 4, "required": true, "estimated_minutes": 2},
    {"name": "Test ventilation in shisha area", "order": 5, "required": true, "estimated_minutes": 2}
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- =============================================
-- SEED DATA: Default Compliance Items
-- =============================================

INSERT INTO compliance_items (title, description, type, status, due_date)
VALUES 
  ('Business License Renewal', 'Annual business operating license', 'license', 'pending', CURRENT_DATE + INTERVAL '90 days'),
  ('Liquor License Renewal', 'Alcohol service permit', 'license', 'pending', CURRENT_DATE + INTERVAL '180 days'),
  ('Food Service Permit', 'Food handling and service permit', 'permit', 'pending', CURRENT_DATE + INTERVAL '365 days'),
  ('Fire Safety Certificate', 'Annual fire safety inspection', 'certification', 'pending', CURRENT_DATE + INTERVAL '120 days'),
  ('Music License (VCPMC)', 'Music performance rights license', 'license', 'pending', CURRENT_DATE + INTERVAL '60 days'),
  ('Health Inspection', 'Quarterly health department inspection', 'audit', 'pending', CURRENT_DATE + INTERVAL '45 days')
ON CONFLICT DO NOTHING;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE announcements IS 'Team announcements with reply support';
COMMENT ON TABLE announcement_replies IS 'Discussion thread replies to announcements';
COMMENT ON TABLE leave_requests IS 'Staff leave/PTO requests with approval workflow';
COMMENT ON TABLE clock_records IS 'Geo-fenced clock in/out records';
COMMENT ON TABLE venue_settings IS 'Venue configuration including geofence coordinates';
COMMENT ON TABLE reservations IS 'Customer reservations from website/email';
COMMENT ON TABLE delegation_tasks IS 'Owner-to-manager task delegation';
COMMENT ON TABLE task_templates IS 'Opening/closing/midshift checklist templates';
COMMENT ON TABLE task_completions IS 'Staff daily task completion records';
COMMENT ON TABLE events IS 'Company calendar events (meetings, holidays, etc.)';
COMMENT ON TABLE promotions IS 'Marketing promotions (informational)';
COMMENT ON TABLE meetings IS 'Team meetings with notes and action items';
COMMENT ON TABLE resource_links IS 'Links to Google Drive SOPs, training, licenses';
COMMENT ON TABLE notifications IS 'In-app notifications for all alert types';
COMMENT ON TABLE translations IS 'Dynamic content translations (EN/VI)';
