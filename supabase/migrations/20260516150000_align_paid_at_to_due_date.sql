-- Cash-out chart uses payment-list due_date; align stored paid_at for paid lines.
UPDATE finance_supplier_debt_items
SET paid_at = due_date
WHERE status = 'paid'
  AND due_date IS NOT NULL
  AND (paid_at IS NULL OR paid_at <> due_date);
