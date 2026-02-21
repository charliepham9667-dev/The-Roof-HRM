ALTER TABLE events
  ADD COLUMN IF NOT EXISTS marketing_status TEXT
    DEFAULT 'not_started'
    CHECK (marketing_status IN (
      'not_started', 'planning', 'urgent', 'confirmed', 'past'
    )),
  ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;

-- checklist shape: [{ "id": "uuid", "text": "string", "done": boolean }]
