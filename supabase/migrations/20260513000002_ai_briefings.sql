-- supabase/migrations/20260513000002_ai_briefings.sql
CREATE TABLE IF NOT EXISTS public.ai_briefings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  briefing_date        DATE        NOT NULL,
  items                JSONB       NOT NULL DEFAULT '[]'::jsonb,
  message_count        INT         DEFAULT 0,
  model                TEXT        DEFAULT 'gpt-4o-mini',
  tokens_used          INT,
  generated_at         TIMESTAMPTZ DEFAULT NOW(),
  delivered_at         TIMESTAMPTZ,
  delivered_message_id UUID,
  feedback_score       INT,
  feedback_at          TIMESTAMPTZ,
  CONSTRAINT unique_user_date UNIQUE (user_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_briefings_user_date
  ON ai_briefings(user_id, briefing_date DESC);

ALTER TABLE ai_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own briefings"
  ON ai_briefings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON ai_briefings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
