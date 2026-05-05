-- Fix: get_target_language 그룹/채널 폴백을 'en' 대신 호출자의 preferred_language 사용
-- 이전: coalesce(v_target, 'en') → 언어 설정과 무관하게 영어로 번역됨
-- 이후: coalesce(v_target, v_my_lang) → 각 사용자의 선호 언어로 번역됨

CREATE OR REPLACE FUNCTION public.get_target_language(
  p_room_id    uuid,
  p_to_user_id uuid DEFAULT null
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public AS $$
DECLARE
  v_current_user uuid := auth.uid();
  v_room_type    text;
  v_target       text;
  v_my_lang      text;
BEGIN
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_room_member(p_room_id, v_current_user) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  -- 호출자 본인의 선호 언어 (폴백으로 사용)
  SELECT preferred_language INTO v_my_lang FROM public.profiles WHERE id = v_current_user;
  v_my_lang := COALESCE(v_my_lang, 'ko');

  SELECT room_type INTO v_room_type FROM public.rooms WHERE id = p_room_id;

  IF v_room_type = 'direct' THEN
    -- 수신자 id가 없으면 자동으로 상대방 조회
    IF p_to_user_id IS NULL THEN
      SELECT user_id INTO p_to_user_id
      FROM public.room_members
      WHERE room_id = p_room_id
        AND user_id != v_current_user
      LIMIT 1;
    END IF;

    -- 1) 발신자가 수신자별로 설정한 언어 우선
    SELECT target_language INTO v_target
    FROM public.translation_preferences
    WHERE from_user_id = v_current_user
      AND to_user_id   = p_to_user_id;

    IF v_target IS NOT NULL THEN
      RETURN v_target;
    END IF;

    -- 2) 수신자의 기본 언어, 없으면 나의 선호 언어
    SELECT preferred_language INTO v_target FROM public.profiles WHERE id = p_to_user_id;
    RETURN COALESCE(v_target, v_my_lang);

  ELSE
    -- 그룹/채널: 방 기본 언어, 없으면 나의 선호 언어 (기존 'en' 하드코딩 제거)
    SELECT default_translation_language INTO v_target FROM public.rooms WHERE id = p_room_id;
    RETURN COALESCE(v_target, v_my_lang);
  END IF;
END;
$$;

REVOKE ALL   ON FUNCTION public.get_target_language(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_target_language(uuid, uuid) TO authenticated;
