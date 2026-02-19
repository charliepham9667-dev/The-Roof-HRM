-- Extend delegation_tasks to support richer task board fields
-- - time_started: when work began
-- - notes: freeform notes inside the task
-- - expand category values to include bar + ordering

-- 1) Add new columns
ALTER TABLE delegation_tasks
  ADD COLUMN IF NOT EXISTS time_started TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2) Expand category check constraint
-- Postgres default constraint name for column check: <table>_<column>_check
ALTER TABLE delegation_tasks
  DROP CONSTRAINT IF EXISTS delegation_tasks_category_check;

ALTER TABLE delegation_tasks
  ADD CONSTRAINT delegation_tasks_category_check
  CHECK (category IN (
    'general',
    'operations',
    'bar',
    'finance',
    'ordering',
    'marketing',
    'event',
    'hr',
    'maintenance'
  ));

