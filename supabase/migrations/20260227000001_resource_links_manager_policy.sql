-- Allow managers (and owners) to create/update/delete resource links.
-- Previously only owners could manage resources; this was causing indefinite
-- loading on INSERT for non-owner roles because the RLS policy silently blocked.

DROP POLICY IF EXISTS "Resources manageable by owner" ON resource_links;
DROP POLICY IF EXISTS "Resources manageable by owner or manager" ON resource_links;

CREATE POLICY "Resources manageable by owner or manager"
  ON resource_links FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'manager', 'bar_manager', 'floor_manager', 'kitchen_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'manager', 'bar_manager', 'floor_manager', 'kitchen_manager')
    )
  );
