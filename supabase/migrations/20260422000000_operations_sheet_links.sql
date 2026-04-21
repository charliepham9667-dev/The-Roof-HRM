-- Operations Sheet Links: stores Google Sheets "Publish to web" URLs for
-- Purchase Request / Payment Request / Inventory tabs so the sheet acts as
-- an auto-updating source of truth embedded inside the Operations page.

CREATE TABLE IF NOT EXISTS operations_sheet_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  sheet_url TEXT NOT NULL,
  embed_url TEXT,
  csv_export_url TEXT,
  sheet_title TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operations_sheet_links_kind_check
    CHECK (kind IN ('purchase_request', 'payment_request', 'inventory')),
  UNIQUE (kind)
);

CREATE INDEX IF NOT EXISTS idx_operations_sheet_links_kind
  ON operations_sheet_links (kind);

ALTER TABLE operations_sheet_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operations_sheet_links_select" ON operations_sheet_links;
CREATE POLICY "operations_sheet_links_select" ON operations_sheet_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR p.role = 'manager'
          OR p.role = 'admin'
        )
    )
  );

DROP POLICY IF EXISTS "operations_sheet_links_write" ON operations_sheet_links;
CREATE POLICY "operations_sheet_links_write" ON operations_sheet_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR p.role = 'manager'
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
          OR p.role = 'manager'
          OR p.role = 'admin'
        )
    )
  );
