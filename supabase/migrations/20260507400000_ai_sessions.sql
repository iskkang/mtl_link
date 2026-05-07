ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS session_id    uuid,
  ADD COLUMN IF NOT EXISTS session_title text;

CREATE INDEX IF NOT EXISTS ai_conversations_session_id_idx
  ON public.ai_conversations(session_id);

CREATE INDEX IF NOT EXISTS ai_conversations_user_session_idx
  ON public.ai_conversations(user_id, session_id, created_at);
