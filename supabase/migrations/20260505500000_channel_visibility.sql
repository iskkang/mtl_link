-- Phase: 채널 가시성 — 공개/비공개 채널 모델 도입

-- 1. is_private + is_default 컬럼 추가
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- 2. 기존 시드 채널 is_default = true 설정
UPDATE public.rooms
  SET is_default = true
  WHERE slug IN ('announcements', 'general');

-- 3. auto_join_channels: is_default=true인 채널만 신규 유저 자동 가입
CREATE OR REPLACE FUNCTION public.auto_join_channels()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.room_members (room_id, user_id, role)
  SELECT id, NEW.id, 'member'
  FROM   public.rooms
  WHERE  room_type = 'channel'
    AND  is_default = true
  ON CONFLICT (room_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 공개 채널 SELECT 허용 (비회원 authenticated 유저도 조회 가능)
DROP POLICY IF EXISTS rooms_select_channel_public ON public.rooms;
CREATE POLICY rooms_select_channel_public ON public.rooms
  FOR SELECT
  TO authenticated
  USING (room_type = 'channel' AND is_private = false);

-- 5. join_channel RPC: SECURITY DEFINER로 INSERT RLS 우회하여 자기 자신 가입
CREATE OR REPLACE FUNCTION public.join_channel(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid    := auth.uid();
  v_type    text;
  v_private boolean;
BEGIN
  SELECT room_type, is_private INTO v_type, v_private
  FROM   rooms WHERE id = p_room_id;

  IF v_type IS NULL     THEN RAISE EXCEPTION 'room_not_found';       END IF;
  IF v_type != 'channel' THEN RAISE EXCEPTION 'not_a_channel';       END IF;
  IF v_private           THEN RAISE EXCEPTION 'channel_is_private';  END IF;

  INSERT INTO room_members (room_id, user_id, role)
  VALUES (p_room_id, v_user_id, 'member')
  ON CONFLICT (room_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_channel(uuid) TO authenticated;

-- 6. leave_room: 공지 채널 나가기 금지
CREATE OR REPLACE FUNCTION public.leave_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         uuid    := auth.uid();
  v_name            text;
  v_type            text;
  v_is_announcement boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM room_members WHERE room_id = p_room_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  SELECT room_type, is_announcement INTO v_type, v_is_announcement
  FROM   rooms WHERE id = p_room_id;

  IF v_is_announcement THEN
    RAISE EXCEPTION 'cannot_leave_announcement';
  END IF;

  SELECT name INTO v_name FROM profiles WHERE id = v_user_id;

  IF v_type = 'group' THEN
    INSERT INTO messages (room_id, sender_id, message_type, content)
    VALUES (p_room_id, null, 'system', v_name || '님이 나갔습니다');
  END IF;

  DELETE FROM room_members WHERE room_id = p_room_id AND user_id = v_user_id;
END;
$$;
