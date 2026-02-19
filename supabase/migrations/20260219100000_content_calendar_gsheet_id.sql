-- Add gsheet_id column to content_calendar for reliable dedup on Google Sheets sync
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS gsheet_id TEXT UNIQUE;

-- Backfill gsheet_id from notes field for existing synced rows
UPDATE content_calendar
SET gsheet_id = split_part(notes, E'\n', 1)
WHERE notes LIKE 'gsheet_id:%' AND gsheet_id IS NULL;
