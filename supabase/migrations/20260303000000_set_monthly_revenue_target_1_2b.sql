-- Set monthly revenue target to 1,200,000,000 VND (1.2B) for 2026.
-- The previous default fallback in code was 750M which was incorrect.

INSERT INTO targets (metric, target_value, period, period_start, period_end)
VALUES
  ('revenue', 1200000000, 'monthly', '2026-03-01', '2026-03-31'),
  ('revenue', 1200000000, 'monthly', '2026-04-01', '2026-04-30'),
  ('revenue', 1200000000, 'monthly', '2026-05-01', '2026-05-31'),
  ('revenue', 1200000000, 'monthly', '2026-06-01', '2026-06-30'),
  ('revenue', 1200000000, 'monthly', '2026-07-01', '2026-07-31'),
  ('revenue', 1200000000, 'monthly', '2026-08-01', '2026-08-31'),
  ('revenue', 1200000000, 'monthly', '2026-09-01', '2026-09-30'),
  ('revenue', 1200000000, 'monthly', '2026-10-01', '2026-10-31'),
  ('revenue', 1200000000, 'monthly', '2026-11-01', '2026-11-30'),
  ('revenue', 1200000000, 'monthly', '2026-12-01', '2026-12-31')
ON CONFLICT DO NOTHING;

-- Also update any existing 2026 rows that may have the wrong 750M value
UPDATE targets
SET target_value = 1200000000
WHERE metric = 'revenue'
  AND period = 'monthly'
  AND period_start >= '2026-01-01'
  AND target_value = 750000000;
