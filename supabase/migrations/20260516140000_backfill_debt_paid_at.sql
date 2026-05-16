-- Paid lines need paid_at for cash-out chart; backfill from last update or due date.
UPDATE finance_supplier_debt_items
SET paid_at = COALESCE(paid_at, (updated_at AT TIME ZONE 'UTC')::date, due_date)
WHERE status = 'paid'
  AND paid_at IS NULL;
