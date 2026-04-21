-- Security hardening pass:
-- - Restrict sensitive financial reads
-- - Remove broad insert permissions for notifications
-- - Tighten wishlist/maintenance write access
-- - Scope chat DM reads to participants
-- - Limit DJ profile reads to active owner/manager roles

CREATE OR REPLACE FUNCTION is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND p.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION is_active_user() FROM public;
GRANT EXECUTE ON FUNCTION is_active_user() TO authenticated;

-- P&L: authenticated/anon broad reads are removed; only active owners/managers can read.
DROP POLICY IF EXISTS "Public can view P&L data" ON pnl_monthly;
DROP POLICY IF EXISTS "Authenticated users can view P&L data" ON pnl_monthly;
DROP POLICY IF EXISTS "Owners can view P&L data" ON pnl_monthly;

CREATE POLICY "pnl_monthly_active_owner_manager_select"
  ON pnl_monthly FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  );

-- Notifications: remove unrestricted insert policy.
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "notifications_insert_owner_manager_only"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    is_active_user()
    AND EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  );

-- Wishlist: staff can read, only active owner/manager can write.
DROP POLICY IF EXISTS "wishlist_items_select" ON wishlist_items;
DROP POLICY IF EXISTS "wishlist_items_insert" ON wishlist_items;
DROP POLICY IF EXISTS "wishlist_items_update" ON wishlist_items;
DROP POLICY IF EXISTS "wishlist_items_delete" ON wishlist_items;

CREATE POLICY "wishlist_items_select_authenticated"
  ON wishlist_items FOR SELECT TO authenticated
  USING (is_active_user());

CREATE POLICY "wishlist_items_insert_manager_owner"
  ON wishlist_items FOR INSERT TO authenticated
  WITH CHECK (
    is_active_user()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  );

CREATE POLICY "wishlist_items_update_manager_owner"
  ON wishlist_items FOR UPDATE TO authenticated
  USING (
    is_active_user()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  )
  WITH CHECK (
    is_active_user()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  );

CREATE POLICY "wishlist_items_delete_manager_owner"
  ON wishlist_items FOR DELETE TO authenticated
  USING (
    is_active_user()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  );

-- Maintenance tasks: same write restrictions as wishlist.
DROP POLICY IF EXISTS "maintenance_tasks_select" ON maintenance_tasks;
DROP POLICY IF EXISTS "maintenance_tasks_insert" ON maintenance_tasks;
DROP POLICY IF EXISTS "maintenance_tasks_update" ON maintenance_tasks;
DROP POLICY IF EXISTS "maintenance_tasks_delete" ON maintenance_tasks;

CREATE POLICY "maintenance_tasks_select_authenticated"
  ON maintenance_tasks FOR SELECT TO authenticated
  USING (is_active_user());

CREATE POLICY "maintenance_tasks_insert_manager_owner"
  ON maintenance_tasks FOR INSERT TO authenticated
  WITH CHECK (
    is_active_user()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  );

CREATE POLICY "maintenance_tasks_update_manager_owner"
  ON maintenance_tasks FOR UPDATE TO authenticated
  USING (
    is_active_user()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  )
  WITH CHECK (
    is_active_user()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  );

CREATE POLICY "maintenance_tasks_delete_manager_owner"
  ON maintenance_tasks FOR DELETE TO authenticated
  USING (
    is_active_user()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  );

-- Chat: reduce DM exposure by requiring users to be participants for dm:* channels.
DROP POLICY IF EXISTS "authenticated users can read chat messages" ON chat_messages;

CREATE POLICY "chat_messages_select_scoped"
  ON chat_messages FOR SELECT TO authenticated
  USING (
    is_active_user()
    AND (
      channel_id NOT LIKE 'dm:%'
      OR channel_id LIKE ('dm:' || auth.uid()::text || ':%')
      OR channel_id LIKE ('dm:%:' || auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "authenticated users can insert own chat messages" ON chat_messages;
CREATE POLICY "chat_messages_insert_own_active"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    is_active_user()
    AND auth.uid() = author_id
  );

-- DJ Profiles: do not expose to every role.
DROP POLICY IF EXISTS "dj_profiles_read" ON dj_profiles;
DROP POLICY IF EXISTS "dj_profiles_write" ON dj_profiles;

CREATE POLICY "dj_profiles_read_owner_manager"
  ON dj_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  );

CREATE POLICY "dj_profiles_write_owner_manager"
  ON dj_profiles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
        AND p.status = 'active'
        AND p.is_active = true
    )
  );
