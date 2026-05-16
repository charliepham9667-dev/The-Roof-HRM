-- ─────────────────────────────────────────────────────────────────────────────
-- 2025 Monthly Revenue Targets
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM targets
WHERE metric = 'revenue'
  AND period  = 'monthly'
  AND period_start >= '2025-01-01'
  AND period_start <= '2025-12-01';

INSERT INTO targets (metric, target_value, period, period_start, period_end)
VALUES
  ('revenue', 400000000, 'monthly', '2025-01-01', '2025-01-31'),
  ('revenue', 700000000, 'monthly', '2025-02-01', '2025-02-28'),
  ('revenue', 750000000, 'monthly', '2025-03-01', '2025-03-31'),
  ('revenue', 900000000, 'monthly', '2025-04-01', '2025-04-30'),
  ('revenue', 900000000, 'monthly', '2025-05-01', '2025-05-31'),
  ('revenue', 900000000, 'monthly', '2025-06-01', '2025-06-30'),
  ('revenue', 900000000, 'monthly', '2025-07-01', '2025-07-31'),
  ('revenue', 900000000, 'monthly', '2025-08-01', '2025-08-31'),
  ('revenue', 700000000, 'monthly', '2025-09-01', '2025-09-30'),
  ('revenue', 600000000, 'monthly', '2025-10-01', '2025-10-31'),
  ('revenue', 600000000, 'monthly', '2025-11-01', '2025-11-30'),
  ('revenue', 700000000, 'monthly', '2025-12-01', '2025-12-31');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2025 Monthly Revenue Actuals (one row per month on the 1st)
-- These feed the "Last year" bars in the Monthly Performance chart.
-- ─────────────────────────────────────────────────────────────────────────────
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
  SET revenue = EXCLUDED.revenue,
      source  = EXCLUDED.source,
      updated_at = NOW();
