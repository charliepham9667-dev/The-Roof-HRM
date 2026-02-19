-- =============================================
-- Migration 011: Fix handle_new_user trigger
-- Makes the trigger idempotent so it never fails
-- on duplicate profile rows during auth user creation.
-- =============================================

-- 1. Diagnostic: find orphaned auth users (no matching profile)
-- Run this SELECT first to see if there are orphans:
--
--   SELECT u.id, u.email, u.created_at
--   FROM auth.users u
--   LEFT JOIN profiles p ON p.id = u.id
--   WHERE p.id IS NULL;
--
-- If any rows appear, those auth users have no profile.
-- You can delete them with:
--   DELETE FROM auth.users WHERE id IN (
--     SELECT u.id FROM auth.users u
--     LEFT JOIN profiles p ON p.id = u.id
--     WHERE p.id IS NULL
--     AND u.email NOT IN (SELECT email FROM profiles)
--   );

-- 2. Diagnostic: find duplicate emails in profiles
--
--   SELECT email, COUNT(*) FROM profiles GROUP BY email HAVING COUNT(*) > 1;

-- 3. Replace the trigger function with an idempotent version.
--    ON CONFLICT (id) DO UPDATE ensures it never fails on re-insert.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger itself doesn't need recreation; it already points at handle_new_user().
-- But we ensure it exists just in case:
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
