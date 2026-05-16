-- Simplify debt line status: pending | stopped | paid (replace approval/approved/overdue)
ALTER TABLE finance_supplier_debt_items
  DROP CONSTRAINT IF EXISTS finance_supplier_debt_items_status_check;

UPDATE finance_supplier_debt_items
SET status = 'pending'
WHERE status IN ('approval', 'approved', 'overdue');

ALTER TABLE finance_supplier_debt_items
  ADD CONSTRAINT finance_supplier_debt_items_status_check
  CHECK (status IN ('pending', 'stopped', 'paid'));
