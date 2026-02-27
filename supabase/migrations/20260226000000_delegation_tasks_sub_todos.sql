-- Add sub_todos JSONB to delegation_tasks
-- Format: [{ id: uuid, text: string, completed: boolean }]
ALTER TABLE delegation_tasks
  ADD COLUMN IF NOT EXISTS sub_todos JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN delegation_tasks.sub_todos IS 'Sub-tasks for staff to check off: [{id, text, completed}]';
