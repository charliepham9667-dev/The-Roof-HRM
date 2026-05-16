-- Step 1: Remove the manual daily_metrics inserts that were double-counting
-- with real Google Sheets daily data.
DELETE FROM daily_metrics
WHERE source = 'manual'
  AND date IN (
    '2025-01-01','2025-02-01','2025-03-01','2025-04-01',
    '2025-05-01','2025-06-01','2025-07-01','2025-08-01',
    '2025-09-01','2025-10-01','2025-11-01','2025-12-01'
  );

-- Step 2: Store 2025 monthly actuals in pnl_monthly (data_type = 'actual').
-- This table is already queried by the dashboard and won't conflict with
-- daily_metrics row-level data.
INSERT INTO pnl_monthly (year, month, gross_sales, data_type)
VALUES
  (2025,  1, 241613450,  'actual'),
  (2025,  2, 569833231,  'actual'),
  (2025,  3, 824828200,  'actual'),
  (2025,  4, 1118470087, 'actual'),
  (2025,  5, 940668607,  'actual'),
  (2025,  6, 712318350,  'actual'),
  (2025,  7, 1174223855, 'actual'),
  (2025,  8, 1285269670, 'actual'),
  (2025,  9, 798674586,  'actual'),
  (2025, 10, 605243088,  'actual'),
  (2025, 11, 35585595,   'actual'),
  (2025, 12, 793372534,  'actual')
ON CONFLICT (year, month, data_type) DO UPDATE
  SET gross_sales = EXCLUDED.gross_sales;
