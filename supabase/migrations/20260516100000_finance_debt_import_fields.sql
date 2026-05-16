-- Debt import metadata from payment-list screenshots
ALTER TABLE finance_supplier_debt_items
  ADD COLUMN IF NOT EXISTS vendor_code TEXT,
  ADD COLUMN IF NOT EXISTS payment_channel TEXT
    CHECK (payment_channel IS NULL OR payment_channel IN ('bank', 'cash')),
  ADD COLUMN IF NOT EXISTS source_import_path TEXT;

CREATE INDEX IF NOT EXISTS idx_finance_supplier_debt_items_import
  ON finance_supplier_debt_items (due_date, payment_channel);
