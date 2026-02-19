-- Add revenue breakdown columns to pnl_monthly table
-- These track sales by category: Wine, Spirits, Cocktails, Shisha, Beer, Food, Balloons, Other

-- Revenue breakdown columns
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS revenue_wine BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS revenue_spirits BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS revenue_cocktails BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS revenue_shisha BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS revenue_beer BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS revenue_food BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS revenue_balloons BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS revenue_other BIGINT DEFAULT 0;

-- COGS balloons (was missing)
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS cogs_balloons BIGINT DEFAULT 0;

-- Add fixed_utilities if not exists (for utilities separate from rental)
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS fixed_utilities BIGINT DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN pnl_monthly.revenue_wine IS 'Wine sales revenue';
COMMENT ON COLUMN pnl_monthly.revenue_spirits IS 'Spirits sales revenue';
COMMENT ON COLUMN pnl_monthly.revenue_cocktails IS 'Cocktails sales revenue';
COMMENT ON COLUMN pnl_monthly.revenue_shisha IS 'Shisha sales revenue';
COMMENT ON COLUMN pnl_monthly.revenue_beer IS 'Beer sales revenue';
COMMENT ON COLUMN pnl_monthly.revenue_food IS 'Food sales revenue';
COMMENT ON COLUMN pnl_monthly.revenue_balloons IS 'Balloons sales revenue';
COMMENT ON COLUMN pnl_monthly.revenue_other IS 'Other revenue (Coke, Water, Mixer, etc.)';
COMMENT ON COLUMN pnl_monthly.cogs_balloons IS 'Cost of goods - Balloons';
