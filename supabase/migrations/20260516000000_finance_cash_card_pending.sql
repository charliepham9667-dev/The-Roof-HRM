-- Card settlements pending (POS) on cash position snapshots
ALTER TABLE finance_cash_position_daily
  ADD COLUMN IF NOT EXISTS card_pending_vnd NUMERIC(18, 2) NOT NULL DEFAULT 0;
