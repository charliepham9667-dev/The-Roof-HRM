-- Add extended P&L fields for comprehensive reporting
-- Includes depreciation, other income/expenses, and additional OPEX breakdown

-- Additional expense tracking
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS depreciation BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS other_income BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS other_expenses BIGINT DEFAULT 0;

-- Extended OPEX breakdown
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS opex_admin BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS opex_office BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS opex_it BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS opex_credit_card_fees BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS opex_entertainment BIGINT DEFAULT 0;

-- Fixed costs breakdown
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS fixed_rental_fee BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS fixed_electricity BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS fixed_water BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS fixed_internet BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS fixed_security BIGINT DEFAULT 0;
ALTER TABLE pnl_monthly ADD COLUMN IF NOT EXISTS fixed_insurance BIGINT DEFAULT 0;

-- Comments
COMMENT ON COLUMN pnl_monthly.depreciation IS 'Fixed asset depreciation';
COMMENT ON COLUMN pnl_monthly.other_income IS 'Other income (VAT refunds, etc.)';
COMMENT ON COLUMN pnl_monthly.other_expenses IS 'Other expenses';
COMMENT ON COLUMN pnl_monthly.opex_admin IS 'Administrative costs';
COMMENT ON COLUMN pnl_monthly.opex_entertainment IS 'Event & Entertainment costs';
