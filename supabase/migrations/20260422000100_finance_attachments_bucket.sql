-- Shared private storage bucket for finance screenshots (supplier debt + cash position).
-- Only owner/admin can upload, select, or delete. Path convention:
--   supplier-debt/{report_date}/{filename}
--   cash-position/{report_date}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('finance-attachments', 'finance-attachments', false, 104857600)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "finance_attachments_storage_insert" ON storage.objects;
CREATE POLICY "finance_attachments_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'finance-attachments'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "finance_attachments_storage_select" ON storage.objects;
CREATE POLICY "finance_attachments_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'finance-attachments'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "finance_attachments_storage_delete" ON storage.objects;
CREATE POLICY "finance_attachments_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'finance-attachments'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  );
