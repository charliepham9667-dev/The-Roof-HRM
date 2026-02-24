-- Employee documents: Supabase Storage + metadata table (replaces Google Drive dependency)
-- Bucket for employee documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-documents',
  'employee-documents',
  false,
  10485760, -- 10 MB per file
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/octet-stream']
) ON CONFLICT (id) DO NOTHING;

-- Owner/manager can upload to employee folders
DROP POLICY IF EXISTS "Owner manager can upload employee documents" ON storage.objects;
CREATE POLICY "Owner manager can upload employee documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'manager')
        AND profiles.status = 'active'
    )
  );

-- Owner/manager can read all; employee can read own
DROP POLICY IF EXISTS "Owner manager can read employee documents" ON storage.objects;
CREATE POLICY "Owner manager can read employee documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('owner', 'manager')
          AND profiles.status = 'active'
      )
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Owner/manager can delete
DROP POLICY IF EXISTS "Owner manager can delete employee documents" ON storage.objects;
CREATE POLICY "Owner manager can delete employee documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'manager')
        AND profiles.status = 'active'
    )
  );

-- Metadata table for document listing
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('hr', 'medical', 'certification')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_category
  ON employee_documents(employee_id, category);

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee docs viewable by owner manager or self" ON employee_documents;
CREATE POLICY "Employee docs viewable by owner manager or self"
  ON employee_documents FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "Employee docs insertable by owner manager" ON employee_documents;
CREATE POLICY "Employee docs insertable by owner manager"
  ON employee_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "Employee docs deletable by owner manager" ON employee_documents;
CREATE POLICY "Employee docs deletable by owner manager"
  ON employee_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'manager')
    )
  );
