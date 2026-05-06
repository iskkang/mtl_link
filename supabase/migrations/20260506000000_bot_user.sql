-- 1. is_bot 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN is_bot boolean NOT NULL DEFAULT false;

-- 2. auto_join_channels 트리거 재정의: 봇 제외 + is_default 조건 유지
CREATE OR REPLACE FUNCTION public.auto_join_channels()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_bot THEN RETURN NEW; END IF;
  INSERT INTO public.room_members (room_id, user_id, role)
  SELECT id, NEW.id, 'member'
  FROM   public.rooms
  WHERE  room_type = 'channel'
    AND  is_default = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. auth.users에 봇 row 삽입 (profiles FK 충족)
INSERT INTO auth.users (
  id, email, encrypted_password, role, aud,
  created_at, updated_at, email_confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'bot@mtl.internal', '', 'authenticated', 'authenticated',
  now(), now(), now()
) ON CONFLICT (id) DO NOTHING;

-- 4. profiles에 봇 row 삽입
INSERT INTO public.profiles (
  id, email, name, is_bot, status, preferred_language, must_change_password
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'bot@mtl.internal', 'MTL 도우미',
  true, 'active', 'ko', false
) ON CONFLICT (id) DO NOTHING;
