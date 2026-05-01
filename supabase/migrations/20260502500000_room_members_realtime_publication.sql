-- room_members가 supabase_realtime publication에 없으면 추가
-- (없으면 postgres_changes UPDATE 이벤트가 전달되지 않음)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_publication_tables
    WHERE  pubname    = 'supabase_realtime'
      AND  schemaname = 'public'
      AND  tablename  = 'room_members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members';
  END IF;
END;
$$;
