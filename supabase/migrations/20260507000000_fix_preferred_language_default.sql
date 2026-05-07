-- Fix: preferred_language default 'ko' → 'en'
-- Affected: column default, handle_new_user trigger, bot profile

-- 1. 컬럼 기본값 변경
ALTER TABLE profiles ALTER COLUMN preferred_language SET DEFAULT 'en';

-- 2. 봇 프로필 업데이트
UPDATE profiles SET preferred_language = 'en' WHERE is_bot = true;

-- 3. handle_new_user 트리거 함수 재정의 (fallback 'ko' → 'en')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_admin_invite boolean;
BEGIN
  v_admin_invite := coalesce(
    (new.raw_user_meta_data->>'must_change_password')::boolean,
    false
  );

  INSERT INTO public.profiles (
    id, email, name,
    department, position, preferred_language,
    must_change_password, status
  )
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'department', ''),
    nullif(new.raw_user_meta_data->>'position',   ''),
    coalesce(nullif(new.raw_user_meta_data->>'preferred_language', ''), 'en'),
    v_admin_invite,
    CASE WHEN v_admin_invite THEN 'active' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;
