-- Seed example maintenance tasks so the Maintenance & Fixes tab is not empty.
-- Uses ON CONFLICT DO NOTHING so re-running is safe.

INSERT INTO maintenance_tasks (title, description, category, priority, status)
VALUES
  (
    'Fix leaking rooftop drain near bar',
    'Water pooling after rain near bar Station 2. Check drain cover and clear debris. Call plumber if blocked.',
    'plumbing',
    'high',
    'open'
  ),
  (
    'Replace broken bar stool — Station 3',
    'Left rear leg cracked. Do not use. Order replacement from supplier or repair with weld.',
    'equipment',
    'medium',
    'open'
  ),
  (
    'Touch up paint — entrance feature wall',
    'Visible scuff marks at shoulder height on the main entrance wall. Schedule for a quiet Monday morning before opening.',
    'aesthetic',
    'low',
    'open'
  )
ON CONFLICT DO NOTHING;
