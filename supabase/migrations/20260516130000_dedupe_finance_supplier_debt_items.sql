-- One-time cleanup: remove duplicate ledger rows from repeated screenshot imports.
-- Keeps the oldest row per vendor + amount + due date + channel + code.
DELETE FROM finance_supplier_debt_items
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          lower(trim(vendor)),
          amount_vnd,
          due_date,
          COALESCE(payment_channel, ''),
          COALESCE(vendor_code, '')
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM finance_supplier_debt_items
  ) ranked
  WHERE rn > 1
);
