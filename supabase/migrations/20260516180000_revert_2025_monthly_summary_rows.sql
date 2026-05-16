-- Remove the manually-inserted monthly summary rows that were double-counting
-- real 2025 daily data already present from Google Sheets sync.
-- The existing daily rows (source = 'google_sheets') for each month are sufficient.
DELETE FROM daily_metrics
WHERE source = 'manual'
  AND date IN (
    '2025-01-01',
    '2025-02-01',
    '2025-03-01',
    '2025-04-01',
    '2025-05-01',
    '2025-06-01',
    '2025-07-01',
    '2025-08-01',
    '2025-09-01',
    '2025-10-01',
    '2025-11-01',
    '2025-12-01'
  );
