-- Insert 2025 monthly revenue actuals into daily_metrics.
-- One row per month on the 1st. Any existing row on that date is updated
-- so we don't create duplicates.
INSERT INTO daily_metrics (date, revenue, source)
VALUES
  ('2025-01-01', 241613450,  'manual'),
  ('2025-02-01', 569833231,  'manual'),
  ('2025-03-01', 824828200,  'manual'),
  ('2025-04-01', 1118470087, 'manual'),
  ('2025-05-01', 940668607,  'manual'),
  ('2025-06-01', 712318350,  'manual'),
  ('2025-07-01', 1174223855, 'manual'),
  ('2025-08-01', 1285269670, 'manual'),
  ('2025-09-01', 798674586,  'manual'),
  ('2025-10-01', 605243088,  'manual'),
  ('2025-11-01', 35585595,   'manual'),
  ('2025-12-01', 793372534,  'manual')
ON CONFLICT (date) DO UPDATE
  SET revenue    = EXCLUDED.revenue,
      source     = EXCLUDED.source,
      updated_at = NOW();
