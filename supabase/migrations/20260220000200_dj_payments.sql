-- ── DJ Rate Config ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dj_rate_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  multiplier decimal(4,2) NOT NULL DEFAULT 1.0,
  base_rate_vnd integer NOT NULL DEFAULT 500000,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO dj_rate_config (event_type, multiplier, base_rate_vnd, notes) VALUES
  ('default',     1.0, 500000, 'Standard rate'),
  ('tet',         1.5, 500000, 'Tết holiday premium'),
  ('new_year',    1.5, 500000, 'New Year premium'),
  ('partnership', 1.0, 500000, 'Standard — partner event')
ON CONFLICT (event_type) DO NOTHING;

ALTER TABLE dj_rate_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read dj_rate_config"
  ON dj_rate_config FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Owners and managers can manage dj_rate_config"
  ON dj_rate_config FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager'))
  );

-- ── DJ Payments ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dj_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- dedup key: date + event_name + dj_name + set_start
  sync_key text UNIQUE,
  date date NOT NULL,
  event_name text NOT NULL,
  event_type text NOT NULL DEFAULT 'default',
  dj_name text NOT NULL,
  dj_type text CHECK (dj_type IN ('foreigner', 'local')),
  set_start time,
  set_end time,
  duration_hours decimal(4,2),
  base_rate_vnd integer NOT NULL DEFAULT 500000,
  multiplier decimal(4,2) NOT NULL DEFAULT 1.0,
  amount_vnd integer,
  amount_override boolean DEFAULT false,
  payer_type text CHECK (payer_type IN ('foreigner_charlie', 'local_company')),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'done', 'no_show')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('paid', 'unpaid', 'na')),
  receipt_uploaded boolean DEFAULT false,
  notes text,
  synced_from_sheet boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dj_payments_date ON dj_payments (date);
CREATE INDEX IF NOT EXISTS idx_dj_payments_sync_key ON dj_payments (sync_key);

ALTER TABLE dj_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read dj_payments"
  ON dj_payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Owners and managers can manage dj_payments"
  ON dj_payments FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager'))
  );

-- updated_at trigger (reuse existing function)
DROP TRIGGER IF EXISTS update_dj_payments_updated_at ON dj_payments;
CREATE TRIGGER update_dj_payments_updated_at
  BEFORE UPDATE ON dj_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
