-- Add reports_to column for org hierarchy
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add index for faster hierarchy queries
CREATE INDEX IF NOT EXISTS idx_profiles_reports_to ON profiles(reports_to);

-- Add department column if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS department TEXT;

