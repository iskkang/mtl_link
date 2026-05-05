-- Phase: 채널 도입
-- rooms 테이블 확장 + 채널 시드 + 자동 가입 트리거

-- 1. room_type CHECK 제약 확장 ('channel' 추가)
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_room_type_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_type_check
  CHECK (room_type IN ('direct', 'group', 'channel'));

-- 2. group_room_name_required 제약 확장 (channel도 name 필수)
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS group_room_name_required;
ALTER TABLE public.rooms ADD CONSTRAINT group_room_name_required CHECK (
  (room_type IN ('group', 'channel') AND name IS NOT NULL AND length(trim(name)) > 0)
  OR room_type = 'direct'
);

-- 3. 채널 전용 컬럼 추가
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS slug            text UNIQUE,
  ADD COLUMN IF NOT EXISTS description    text,
  ADD COLUMN IF NOT EXISTS is_announcement boolean NOT NULL DEFAULT false;

-- 4. 시드 채널 2개
INSERT INTO public.rooms (name, slug, room_type, is_announcement, description)
VALUES
  ('공지', 'announcements', 'channel', true,  '회사 공지사항'),
  ('일반', 'general',       'channel', false, '자유롭게 대화하는 채널')
ON CONFLICT (slug) DO NOTHING;

-- 5. 기존 모든 유저를 채널에 자동 가입
INSERT INTO public.room_members (room_id, user_id, role)
SELECT r.id, p.id, 'member'
FROM   public.rooms   r
CROSS  JOIN public.profiles p
WHERE  r.room_type = 'channel'
ON CONFLICT (room_id, user_id) DO NOTHING;

-- 6. 신규 유저 가입 시 모든 채널 자동 등록 트리거
CREATE OR REPLACE FUNCTION public.auto_join_channels()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.room_members (room_id, user_id, role)
  SELECT id, NEW.id, 'member'
  FROM   public.rooms
  WHERE  room_type = 'channel'
  ON CONFLICT (room_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_join_channels ON public.profiles;
CREATE TRIGGER trg_auto_join_channels
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_join_channels();
