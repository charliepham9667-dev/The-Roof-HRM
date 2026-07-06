-- Bonus reconciliation for the monthly salary sheet.
-- Lets the owner check the surplus bonus that was PAID (the "Thưởng vượt doanh thu"
-- line on the accountant sheet) against what the 2026 Surplus Bonus Framework says
-- SHOULD have been paid: pool = max(0, qualifying_revenue - monthly_target) x 7%,
-- then scaled by the Google review gate (4.8*+100rev=100%, 4.7*+70=70%, 4.6*+35=35%,
-- else 0%). All fields are nullable — a month with no bonus data just skips the check.
-- The policy math itself is computed in the app (src/lib/bonus-check.ts), not here,
-- because the gate is conditional.

ALTER TABLE salary_monthly
  ADD COLUMN IF NOT EXISTS monthly_target_vnd       BIGINT,   -- revenue target the surplus is measured against
  ADD COLUMN IF NOT EXISTS qualifying_revenue_vnd   BIGINT,   -- revenue that counts: after service charge, FOC, VAT
  ADD COLUMN IF NOT EXISTS google_rating            NUMERIC(2,1), -- avg Google rating that month (gate input)
  ADD COLUMN IF NOT EXISTS new_reviews              INTEGER,  -- new Google reviews that month (gate input)
  ADD COLUMN IF NOT EXISTS surplus_bonus_paid_vnd   BIGINT;   -- surplus bonus actually paid (Thưởng vượt doanh thu)

COMMENT ON COLUMN salary_monthly.monthly_target_vnd IS 'Monthly revenue target the surplus bonus is measured against (AIOS schedule).';
COMMENT ON COLUMN salary_monthly.qualifying_revenue_vnd IS 'Qualifying revenue after service charge, FOC and VAT — the figure compared to target.';
COMMENT ON COLUMN salary_monthly.google_rating IS 'Average Google rating that month — Surplus Bonus Framework gate input.';
COMMENT ON COLUMN salary_monthly.new_reviews IS 'New Google reviews that month — Surplus Bonus Framework gate input.';
COMMENT ON COLUMN salary_monthly.surplus_bonus_paid_vnd IS 'Surplus bonus actually paid on the sheet (Thưởng vượt doanh thu), reconciled vs policy.';
