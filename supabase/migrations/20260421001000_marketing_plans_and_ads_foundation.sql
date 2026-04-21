-- Marketing plans + ads integrations foundation

CREATE TABLE IF NOT EXISTS marketing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  objective TEXT,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_plan_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES marketing_plans(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_plans_status_dates
  ON marketing_plans(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_marketing_plan_assets_plan
  ON marketing_plan_assets(plan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'facebook_ads', 'tiktok_ads')),
  account_id TEXT NOT NULL,
  account_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, account_id)
);

CREATE TABLE IF NOT EXISTS ads_campaigns_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'facebook_ads', 'tiktok_ads')),
  account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  metric_date DATE NOT NULL,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  conversions NUMERIC NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  cpc NUMERIC,
  cpm NUMERIC,
  ctr NUMERIC,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, account_id, campaign_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_ads_campaigns_daily_platform_date
  ON ads_campaigns_daily(platform, metric_date DESC);

CREATE TABLE IF NOT EXISTS marketing_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'facebook_ads', 'tiktok_ads', 'all')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rows_upserted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('marketing-plan-assets', 'marketing-plan-assets', false, 15728640)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE marketing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_plan_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads_campaigns_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_plans_select" ON marketing_plans;
CREATE POLICY "marketing_plans_select" ON marketing_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  );

DROP POLICY IF EXISTS "marketing_plans_write" ON marketing_plans;
CREATE POLICY "marketing_plans_write" ON marketing_plans
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  );

DROP POLICY IF EXISTS "marketing_plan_assets_select" ON marketing_plan_assets;
CREATE POLICY "marketing_plan_assets_select" ON marketing_plan_assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  );

DROP POLICY IF EXISTS "marketing_plan_assets_write" ON marketing_plan_assets;
CREATE POLICY "marketing_plan_assets_write" ON marketing_plan_assets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  );

DROP POLICY IF EXISTS "marketing_integrations_owner_manager" ON marketing_integrations;
CREATE POLICY "marketing_integrations_owner_manager" ON marketing_integrations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  );

DROP POLICY IF EXISTS "ads_campaigns_daily_owner_manager_read" ON ads_campaigns_daily;
CREATE POLICY "ads_campaigns_daily_owner_manager_read" ON ads_campaigns_daily
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  );

DROP POLICY IF EXISTS "marketing_sync_runs_owner_manager" ON marketing_sync_runs;
CREATE POLICY "marketing_sync_runs_owner_manager" ON marketing_sync_runs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  );

DROP POLICY IF EXISTS "marketing_assets_storage_insert" ON storage.objects;
CREATE POLICY "marketing_assets_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketing-plan-assets'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  );

DROP POLICY IF EXISTS "marketing_assets_storage_select" ON storage.objects;
CREATE POLICY "marketing_assets_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'marketing-plan-assets'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  );

DROP POLICY IF EXISTS "marketing_assets_storage_delete" ON storage.objects;
CREATE POLICY "marketing_assets_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketing-plan-assets'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR (p.role = 'manager' AND p.manager_type = 'marketing'))
    )
  );
