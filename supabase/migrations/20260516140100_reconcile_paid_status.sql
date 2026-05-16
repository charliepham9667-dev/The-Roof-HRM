-- Rows with paid_at set were paid; status may still be pending after status enum migration.
UPDATE finance_supplier_debt_items
SET status = 'paid'
WHERE paid_at IS NOT NULL
  AND status <> 'paid';
