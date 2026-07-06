-- Monthly salary overview. Every month the accountant sends a salary sheet (PDF).
-- The owner uploads it under Team Overview → Salary; an AI parse extracts the
-- category totals (fixed salary, service charge, insurance, food, bonuses, overtime,
-- other) and stores one row per month here so the page can show a trend + breakdown.

CREATE TABLE IF NOT EXISTS salary_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  fixed_salary_vnd BIGINT NOT NULL DEFAULT 0,   -- Lương chính thức + thử việc (base earned pay)
  svc_vnd          BIGINT NOT NULL DEFAULT 0,   -- Phí Phục Vụ (service charge to staff)
  insurance_vnd    BIGINT NOT NULL DEFAULT 0,   -- EMPLOYER social-insurance contribution (~21.5% of base) — company cost on top of gross
  food_vnd         BIGINT NOT NULL DEFAULT 0,   -- Phụ cấp cơm ca (meal allowance)
  bonuses_vnd      BIGINT NOT NULL DEFAULT 0,   -- Lễ/Tết + thưởng (holiday/Tet + perf/13th)
  overtime_vnd     BIGINT NOT NULL DEFAULT 0,   -- Tăng ca (OT pay)
  other_vnd        BIGINT NOT NULL DEFAULT 0,   -- Phụ cấp khác + truy lĩnh (other allowances)
  -- Full company cost of employment = gross earnings + employer insurance.
  total_vnd        BIGINT GENERATED ALWAYS AS (
    fixed_salary_vnd + svc_vnd + insurance_vnd + food_vnd + bonuses_vnd + overtime_vnd + other_vnd
  ) STORED,
  insurance_base_vnd BIGINT NOT NULL DEFAULT 0, -- Mức đóng (salary base insurance is calculated on)
  gross_income_vnd   BIGINT NOT NULL DEFAULT 0, -- Tổng thu nhập (sheet's gross; ≈ sum of the 6 earning buckets)
  net_paid_vnd       BIGINT NOT NULL DEFAULT 0, -- Thực nhận (what staff actually receive after their deductions)
  headcount INTEGER,
  notes TEXT,
  source_file_path TEXT,
  source_file_name TEXT,
  source_file_mime_type TEXT,
  source_file_size_bytes BIGINT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month)
);

CREATE INDEX IF NOT EXISTS idx_salary_monthly_year_month
  ON salary_monthly (year DESC, month DESC);

ALTER TABLE salary_monthly ENABLE ROW LEVEL SECURITY;

-- Salary is sensitive: only active owner/admin can read or write.
DROP POLICY IF EXISTS "salary_monthly_select" ON salary_monthly;
CREATE POLICY "salary_monthly_select" ON salary_monthly
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "salary_monthly_write" ON salary_monthly;
CREATE POLICY "salary_monthly_write" ON salary_monthly
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  );

-- Service role can manage (for any server-side sync).
DROP POLICY IF EXISTS "salary_monthly_service_role" ON salary_monthly;
CREATE POLICY "salary_monthly_service_role" ON salary_monthly
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION update_salary_monthly_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_salary_monthly_updated_at ON salary_monthly;
CREATE TRIGGER trigger_salary_monthly_updated_at
  BEFORE UPDATE ON salary_monthly
  FOR EACH ROW
  EXECUTE FUNCTION update_salary_monthly_updated_at();

COMMENT ON TABLE salary_monthly IS 'Monthly salary breakdown uploaded by owner from the accountant PDF (Team Overview → Salary).';
