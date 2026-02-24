-- =============================================
-- Allow all authenticated staff to create/update reservations
-- (receptionists, cashiers, hosts, floor staff all need walk-in access)
-- =============================================

-- Drop the manager-only insert/update/delete policy
DROP POLICY IF EXISTS "Reservations manageable by managers" ON reservations;

-- Allow all authenticated users to insert reservations
DROP POLICY IF EXISTS "Reservations insertable by authenticated" ON reservations;
CREATE POLICY "Reservations insertable by authenticated"
  ON reservations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow managers/owners to update and delete
DROP POLICY IF EXISTS "Reservations updatable by managers" ON reservations;
CREATE POLICY "Reservations updatable by managers"
  ON reservations FOR UPDATE TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

DROP POLICY IF EXISTS "Reservations deletable by managers" ON reservations;
CREATE POLICY "Reservations deletable by managers"
  ON reservations FOR DELETE TO authenticated
  USING (is_manager_or_owner());
