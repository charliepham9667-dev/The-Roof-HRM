-- Employee payment tables: banking, pay details, benefits

-- Banking details (1:1 with employee)
CREATE TABLE IF NOT EXISTS employee_banking_details (
  employee_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  bank_name TEXT,
  account_name TEXT,
  account_number TEXT,
  bsb_swift TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pay details (history-capable, effective dated)
CREATE TABLE IF NOT EXISTS employee_pay_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pay_type TEXT NOT NULL CHECK (pay_type IN ('hourly', 'salary')),
  rate_value NUMERIC NOT NULL,
  currency TEXT DEFAULT 'VND',
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_pay_details_employee_id
  ON employee_pay_details(employee_id);

-- Employee benefits (0:n)
DROP TABLE IF EXISTS employee_benefits;
CREATE TABLE employee_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  benefit_type TEXT NOT NULL,
  amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_benefits_employee_id
  ON employee_benefits(employee_id);

-- RLS: owner/manager can read/write
ALTER TABLE employee_banking_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_pay_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_benefits ENABLE ROW LEVEL SECURITY;

-- Banking
DROP POLICY IF EXISTS "Banking viewable by owner manager" ON employee_banking_details;
CREATE POLICY "Banking viewable by owner manager"
  ON employee_banking_details FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR is_manager_or_owner());

DROP POLICY IF EXISTS "Banking insert update by owner manager" ON employee_banking_details;
CREATE POLICY "Banking insert update by owner manager"
  ON employee_banking_details FOR ALL
  TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Pay details
DROP POLICY IF EXISTS "Pay details viewable by owner manager" ON employee_pay_details;
CREATE POLICY "Pay details viewable by owner manager"
  ON employee_pay_details FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR is_manager_or_owner());

DROP POLICY IF EXISTS "Pay details insert update delete by owner manager" ON employee_pay_details;
CREATE POLICY "Pay details insert update delete by owner manager"
  ON employee_pay_details FOR ALL
  TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Benefits
DROP POLICY IF EXISTS "Benefits viewable by owner manager" ON employee_benefits;
CREATE POLICY "Benefits viewable by owner manager"
  ON employee_benefits FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR is_manager_or_owner());

DROP POLICY IF EXISTS "Benefits insert update delete by owner manager" ON employee_benefits;
CREATE POLICY "Benefits insert update delete by owner manager"
  ON employee_benefits FOR ALL
  TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());
