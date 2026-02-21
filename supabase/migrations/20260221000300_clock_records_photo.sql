-- Add photo_url column to clock_records
ALTER TABLE clock_records ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create the clock-in-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clock-in-photos',
  'clock-in-photos',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: staff can upload their own photos (path must start with their user id)
CREATE POLICY "Staff can upload own clock photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clock-in-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: staff can read their own photos
CREATE POLICY "Staff can read own clock photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'clock-in-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: managers and owners can read all clock photos
CREATE POLICY "Managers can read all clock photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'clock-in-photos'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('manager', 'owner')
    AND profiles.is_active = true
  )
);

-- RLS: staff can delete their own photos (for cleanup support)
CREATE POLICY "Staff can delete own clock photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'clock-in-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
