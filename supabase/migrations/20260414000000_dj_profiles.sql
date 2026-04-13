-- DJ Profiles: persistent per-DJ settings that survive sync
-- Stores the canonical dj_type and payer_type for each DJ by name.
-- During sync, if a profile exists for a DJ, those values are used
-- instead of the auto-classification logic, so manual edits are preserved.

CREATE TABLE IF NOT EXISTS dj_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dj_name text NOT NULL UNIQUE,               -- case-insensitive match key
  dj_name_display text,                        -- display name with correct casing
  dj_type text NOT NULL DEFAULT 'local'
    CHECK (dj_type IN ('foreigner', 'local')),
  payer_type text NOT NULL DEFAULT 'local_company'
    CHECK (payer_type IN ('foreigner_charlie', 'local_company')),
  base_rate_vnd integer,                       -- optional rate override per DJ
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed known DJs from the existing hardcoded lists
INSERT INTO dj_profiles (dj_name, dj_name_display, dj_type, payer_type) VALUES
  ('throbak',   'Throbak',   'foreigner', 'foreigner_charlie'),
  ('amor',      'Amor',      'local',     'local_company'),
  ('charles',   'Charles',   'local',     'local_company'),
  ('tarantoty', 'Tarantoty', 'foreigner', 'foreigner_charlie'),
  ('donners',   'Donners',   'local',     'local_company'),
  ('dark',      'Dark',      'local',     'local_company'),
  ('savurplay', 'SavurPlay', 'local',     'local_company')
ON CONFLICT (dj_name) DO NOTHING;

-- RLS: owners and managers can read; only owners can write
ALTER TABLE dj_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dj_profiles_read" ON dj_profiles
  FOR SELECT USING (true);

CREATE POLICY "dj_profiles_write" ON dj_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_dj_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dj_profiles_updated_at
  BEFORE UPDATE ON dj_profiles
  FOR EACH ROW EXECUTE FUNCTION update_dj_profiles_updated_at();
