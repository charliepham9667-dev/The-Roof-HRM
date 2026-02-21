-- Chat messages table for persisting channel and DM messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_channel_id_created_at_idx
  ON chat_messages (channel_id, created_at);

-- Enable realtime replication
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read chat messages"
  ON chat_messages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated users can insert own chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = author_id);
