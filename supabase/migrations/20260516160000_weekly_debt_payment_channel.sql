-- Allow multiple history rows per calendar day (manual Friday vs bank/cash payment lists).
ALTER TABLE finance_supplier_debt_weekly
  ADD COLUMN IF NOT EXISTS payment_channel TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE finance_supplier_debt_weekly
  DROP CONSTRAINT IF EXISTS finance_supplier_debt_weekly_report_date_key;

ALTER TABLE finance_supplier_debt_weekly
  DROP CONSTRAINT IF EXISTS finance_supplier_debt_weekly_payment_channel_check;

ALTER TABLE finance_supplier_debt_weekly
  ADD CONSTRAINT finance_supplier_debt_weekly_payment_channel_check
  CHECK (payment_channel IN ('manual', 'bank', 'cash'));

UPDATE finance_supplier_debt_weekly
SET payment_channel = 'manual'
WHERE payment_channel IS NULL OR payment_channel NOT IN ('manual', 'bank', 'cash');

ALTER TABLE finance_supplier_debt_weekly
  ADD CONSTRAINT finance_supplier_debt_weekly_report_date_channel_key
  UNIQUE (report_date, payment_channel);
