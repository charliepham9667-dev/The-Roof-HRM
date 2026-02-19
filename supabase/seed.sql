-- =============================================
-- The Roof HRM - Seed Data
-- =============================================
-- Run this after the migration to populate dev data

-- Daily Metrics (last 7 days)
INSERT INTO daily_metrics (date, revenue, pax, avg_spend, labor_cost, staff_on_duty, hours_scheduled, hours_worked, projected_revenue)
VALUES
  (CURRENT_DATE - INTERVAL '6 days', 680000000, 1890, 360000, 85000000, 12, 96, 94, 650000000),
  (CURRENT_DATE - INTERVAL '5 days', 720000000, 2010, 358000, 88000000, 14, 112, 110, 700000000),
  (CURRENT_DATE - INTERVAL '4 days', 750000000, 2100, 357000, 90000000, 15, 120, 118, 730000000),
  (CURRENT_DATE - INTERVAL '3 days', 810000000, 2250, 360000, 95000000, 16, 128, 125, 780000000),
  (CURRENT_DATE - INTERVAL '2 days', 850000000, 2350, 362000, 98000000, 18, 144, 140, 820000000),
  (CURRENT_DATE - INTERVAL '1 day', 780000000, 2180, 358000, 92000000, 15, 120, 118, 760000000),
  (CURRENT_DATE, 794000000, 2211, 359000, 94000000, 16, 128, 126, 750000000);

-- Reviews
INSERT INTO reviews (source, author_name, rating, comment, sentiment_score, published_at)
VALUES
  ('google', 'Minh T.', 5.0, 'Amazing rooftop experience! The view was stunning and service impeccable.', 0.95, NOW() - INTERVAL '2 hours'),
  ('tripadvisor', 'Sarah L.', 4.5, 'Great cocktails and atmosphere. Will definitely come back!', 0.88, NOW() - INTERVAL '5 hours'),
  ('google', 'David N.', 5.0, 'Best sunset views in Da Nang. Staff was incredibly attentive.', 0.92, NOW() - INTERVAL '1 day'),
  ('facebook', 'Linh P.', 4.0, 'Nice place but a bit crowded on weekends. Music was great though!', 0.75, NOW() - INTERVAL '2 days'),
  ('google', 'Tom W.', 4.5, 'Excellent service and food. The truffle fries are a must-try!', 0.85, NOW() - INTERVAL '3 days');

-- Compliance Items
INSERT INTO compliance_items (title, description, type, status, due_date)
VALUES
  ('Liquor License Renewal', 'License expires soon. Renewal application required.', 'license', 'action_required', CURRENT_DATE + INTERVAL '14 days'),
  ('Food Handler Permits', '2 staff members need recertification.', 'certification', 'needs_attention', CURRENT_DATE + INTERVAL '30 days'),
  ('Safety Audit', 'Passed inspection on Oct 24, 2025.', 'audit', 'passed', NULL),
  ('Fire Safety Certificate', 'Annual inspection due.', 'certification', 'pending', CURRENT_DATE + INTERVAL '60 days'),
  ('Health Department Inspection', 'Quarterly inspection passed.', 'audit', 'passed', NULL);

-- Targets (monthly)
INSERT INTO targets (metric, target_value, period, period_start, period_end)
VALUES
  ('revenue', 750000000, 'monthly', DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'),
  ('pax', 2000, 'monthly', DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'),
  ('labor_cost_percentage', 30, 'monthly', DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day');
