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

-- REPLICA IDENTITY FULL 설정: room_id 등 비PK 컬럼으로 UPDATE 필터링 시 필수
-- DEFAULT(d)이면 postgres_changes UPDATE 이벤트가 room_id 필터를 무시함
ALTER TABLE public.room_members REPLICA IDENTITY FULL;
