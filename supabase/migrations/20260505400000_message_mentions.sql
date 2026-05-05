ALTER TABLE messages
  ADD COLUMN mentions uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE INDEX idx_messages_mentions_gin ON messages USING gin(mentions);
