-- supabase/migrations/20260513000001_messages_mint_briefing_payload.sql
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN (
    'text', 'image', 'file', 'link',
    'system', 'voice_translated', 'text_translated', 'mint_briefing'
  ));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS payload JSONB;
