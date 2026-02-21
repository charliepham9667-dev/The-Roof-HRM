-- ============================================================================
-- FIX: Content calendar deduplication
--
-- Problem: rows synced before gsheet_id column was added have gsheet_id = NULL.
-- On subsequent syncs, Supabase cannot match them via the unique constraint,
-- so it inserts new rows rather than updating, creating duplicates.
--
-- This migration:
-- 1. Deletes all rows where gsheet_id IS NULL (pre-column rows that can never
--    be deduped — they will be cleanly re-synced from the sheet).
-- 2. Ensures the unique index on gsheet_id is present (idempotent).
-- ============================================================================

-- Remove rows that have no gsheet_id (cannot be deduped by the upsert logic)
DELETE FROM content_calendar WHERE gsheet_id IS NULL;

-- Ensure unique index exists (safe to re-run)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_calendar_gsheet_id ON content_calendar(gsheet_id);
