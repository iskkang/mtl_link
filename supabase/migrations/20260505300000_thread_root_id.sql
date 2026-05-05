-- Add thread columns to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS thread_root_id    uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS thread_reply_count int  NOT NULL DEFAULT 0;

-- Fast lookup of all replies for a given thread
CREATE INDEX IF NOT EXISTS idx_messages_thread_root ON public.messages(thread_root_id);

-- Maintain thread_reply_count on INSERT and soft-delete
CREATE OR REPLACE FUNCTION public.update_thread_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.thread_root_id IS NOT NULL THEN
    UPDATE public.messages
      SET thread_reply_count = thread_reply_count + 1
      WHERE id = NEW.thread_root_id;

  ELSIF TG_OP = 'UPDATE' AND NEW.thread_root_id IS NOT NULL
    AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.messages
      SET thread_reply_count = GREATEST(thread_reply_count - 1, 0)
      WHERE id = NEW.thread_root_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_thread_reply_count ON public.messages;
CREATE TRIGGER trg_thread_reply_count
  AFTER INSERT OR UPDATE OF deleted_at ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_thread_reply_count();
