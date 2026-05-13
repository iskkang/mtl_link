-- Dedicated mentions table for read/unread tracking
-- (messages.mentions[] already stores IDs for rendering — this table adds read state)
CREATE TABLE IF NOT EXISTS mentions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        UUID        NOT NULL REFERENCES messages(id)  ON DELETE CASCADE,
  mentioned_user_id UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  mentioner_id      UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  room_id           UUID        NOT NULL REFERENCES rooms(id)     ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at           TIMESTAMPTZ,
  UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX idx_mentions_user_unread
  ON mentions(mentioned_user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_mentions_message
  ON mentions(message_id);

CREATE INDEX idx_mentions_room
  ON mentions(room_id, created_at DESC);

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mentions"
  ON mentions FOR SELECT
  USING (auth.uid() = mentioned_user_id OR auth.uid() = mentioner_id);

CREATE POLICY "Users can insert mentions for their messages"
  ON mentions FOR INSERT
  WITH CHECK (auth.uid() = mentioner_id);

CREATE POLICY "Users can mark their mentions as read"
  ON mentions FOR UPDATE
  USING (auth.uid() = mentioned_user_id)
  WITH CHECK (auth.uid() = mentioned_user_id);

COMMENT ON TABLE mentions IS
  '@username mentions with per-user read tracking. Separate from messages.mentions[] which is used for rendering.';

-- RPC: count unread mentions for a user
CREATE OR REPLACE FUNCTION get_unread_mentions_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM mentions
  WHERE mentioned_user_id = p_user_id
    AND read_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION get_unread_mentions_count TO authenticated;
