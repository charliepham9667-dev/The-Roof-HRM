-- Event attachments: per-event PDFs / files (EOFs, partner agreements, riders,
-- menus for takeovers, etc.). Uses the same RLS pattern as marketing plan
-- assets so owners and marketing managers can manage them.

CREATE TABLE IF NOT EXISTS event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  label TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_attachments_event_id
  ON event_attachments(event_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('event-attachments', 'event-attachments', false, 104857600)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

ALTER TABLE event_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_attachments_select" ON event_attachments;
CREATE POLICY "event_attachments_select" ON event_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND p.manager_type = 'marketing')
          OR p.role = 'admin'
        )
    )
  );

DROP POLICY IF EXISTS "event_attachments_write" ON event_attachments;
CREATE POLICY "event_attachments_write" ON event_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND p.manager_type = 'marketing')
          OR p.role = 'admin'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND p.manager_type = 'marketing')
          OR p.role = 'admin'
        )
    )
  );

DROP POLICY IF EXISTS "event_attachments_storage_insert" ON storage.objects;
CREATE POLICY "event_attachments_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-attachments'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND p.manager_type = 'marketing')
          OR p.role = 'admin'
        )
    )
  );

DROP POLICY IF EXISTS "event_attachments_storage_select" ON storage.objects;
CREATE POLICY "event_attachments_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-attachments'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND p.manager_type = 'marketing')
          OR p.role = 'admin'
        )
    )
  );

DROP POLICY IF EXISTS "event_attachments_storage_delete" ON storage.objects;
CREATE POLICY "event_attachments_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-attachments'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND p.manager_type = 'marketing')
          OR p.role = 'admin'
        )
    )
  );
