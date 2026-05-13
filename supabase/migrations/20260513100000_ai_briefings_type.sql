-- Add briefing_type column and update unique constraint to support weekly briefings
ALTER TABLE ai_briefings
  ADD COLUMN IF NOT EXISTS briefing_type TEXT NOT NULL DEFAULT 'daily'
    CHECK (briefing_type IN ('daily', 'weekly'));

-- Drop old unique constraint (user_id, briefing_date) and replace with
-- (user_id, briefing_date, briefing_type) so daily + weekly can coexist
ALTER TABLE ai_briefings DROP CONSTRAINT IF EXISTS unique_user_date;

ALTER TABLE ai_briefings
  ADD CONSTRAINT ai_briefings_user_date_type_key
  UNIQUE (user_id, briefing_date, briefing_type);

CREATE INDEX IF NOT EXISTS idx_ai_briefings_type
  ON ai_briefings(briefing_type, briefing_date DESC);

COMMENT ON COLUMN ai_briefings.briefing_type IS
  'Type of briefing: daily (24h analysis, every morning) or weekly (7-day analysis, Monday morning)';
