CREATE TABLE IF NOT EXISTS marketing_social_monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month DATE NOT NULL,
  source_file_name TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_month)
);

CREATE INDEX IF NOT EXISTS idx_marketing_social_monthly_reports_month
  ON marketing_social_monthly_reports (report_month DESC);

ALTER TABLE marketing_social_monthly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_social_monthly_reports_select" ON marketing_social_monthly_reports;
CREATE POLICY "marketing_social_monthly_reports_select" ON marketing_social_monthly_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND p.manager_type = 'marketing')
          OR p.role = 'admin'
        )
    )
  );

DROP POLICY IF EXISTS "marketing_social_monthly_reports_write" ON marketing_social_monthly_reports;
CREATE POLICY "marketing_social_monthly_reports_write" ON marketing_social_monthly_reports
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND p.manager_type = 'marketing')
          OR p.role = 'admin'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND p.manager_type = 'marketing')
          OR p.role = 'admin'
        )
    )
  );
