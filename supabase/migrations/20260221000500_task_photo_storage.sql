-- Create storage bucket for task checklist photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-checklist-photos',
  'task-checklist-photos',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Staff can upload their own photos
CREATE POLICY "Staff can upload own task photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-checklist-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff can read their own photos
CREATE POLICY "Staff can read own task photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-checklist-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff can delete their own photos
CREATE POLICY "Staff can delete own task photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-checklist-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Managers and owners can read all task photos
CREATE POLICY "Managers can read all task photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-checklist-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('manager', 'owner')
        AND profiles.status = 'active'
    )
  );
