-- Add status column to profiles for owner approval flow
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'active', 'rejected'));

-- All currently active employees stay active
UPDATE profiles SET status = 'active' WHERE is_active = true;

-- Update RLS: pending users can read their own profile (to show pending screen)
-- but cannot access any other tables until status = 'active'
-- (existing RLS policies already handle this via is_active checks)
