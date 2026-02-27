-- Per-conversation read state: when did user_id last read messages from peer_id.
-- Unread from peer = messages in @my_id from peer where created_at > last_read_at.
-- Read receipt: my message to peer is "Seen" when (peer, me).last_read_at >= message.created_at.

CREATE TABLE IF NOT EXISTS chat_conversation_read (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  peer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, peer_id)
);

CREATE INDEX IF NOT EXISTS chat_conversation_read_user_peer_idx
  ON chat_conversation_read (user_id, peer_id);

ALTER TABLE chat_conversation_read ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read conversation read state"
  ON chat_conversation_read FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own conversation read state"
  ON chat_conversation_read FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversation read state"
  ON chat_conversation_read FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversation read state"
  ON chat_conversation_read FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
