-- Backfill weekly history rows from existing payment-list line imports.
INSERT INTO finance_supplier_debt_weekly (
  report_date,
  payment_channel,
  total_debt_vnd,
  notes,
  source_file_path
)
SELECT
  due_date AS report_date,
  COALESCE(payment_channel, 'bank') AS payment_channel,
  SUM(amount_vnd)::numeric AS total_debt_vnd,
  'Payment list · ' || initcap(COALESCE(payment_channel, 'bank')) || ' · '
    || COUNT(*)::text || ' lines (backfill)' AS notes,
  (array_agg(source_import_path ORDER BY created_at DESC))[1] AS source_file_path
FROM finance_supplier_debt_items
WHERE source_import_path IS NOT NULL
  AND source_import_path LIKE 'debt-import/%'
GROUP BY due_date, payment_channel
ON CONFLICT (report_date, payment_channel) DO UPDATE SET
  total_debt_vnd = EXCLUDED.total_debt_vnd,
  notes = EXCLUDED.notes,
  source_file_path = COALESCE(
    finance_supplier_debt_weekly.source_file_path,
    EXCLUDED.source_file_path
  ),
  updated_at = NOW();
