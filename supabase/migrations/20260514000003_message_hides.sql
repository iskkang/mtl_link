-- 나에게만 삭제: 메시지를 특정 사용자에게만 숨기는 테이블
CREATE TABLE IF NOT EXISTS public.message_hides (
  message_id uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_hides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'message_hides' AND policyname = 'users can manage own message hides'
  ) THEN
    CREATE POLICY "users can manage own message hides"
      ON public.message_hides
      USING     (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
