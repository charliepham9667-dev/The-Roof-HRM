ALTER TABLE marketing_social_monthly_reports
  ADD COLUMN IF NOT EXISTS source_file_path TEXT,
  ADD COLUMN IF NOT EXISTS source_file_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS source_file_size_bytes BIGINT;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('marketing-social-reports', 'marketing-social-reports', false, 104857600)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "marketing_social_reports_storage_insert" ON storage.objects;
CREATE POLICY "marketing_social_reports_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketing-social-reports'
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

DROP POLICY IF EXISTS "marketing_social_reports_storage_select" ON storage.objects;
CREATE POLICY "marketing_social_reports_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'marketing-social-reports'
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

DROP POLICY IF EXISTS "marketing_social_reports_storage_delete" ON storage.objects;
CREATE POLICY "marketing_social_reports_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketing-social-reports'
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
