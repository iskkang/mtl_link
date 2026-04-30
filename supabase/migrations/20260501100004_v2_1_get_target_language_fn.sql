-- 번역 도착어 결정 함수
-- 우선순위: 1) 발신자의 수신자별 설정 → 2) 수신자 기본 언어 → 3) 'en' 기본값
create or replace function public.get_target_language(
  p_room_id    uuid,
  p_to_user_id uuid default null
)
returns text
language plpgsql security definer stable
set search_path = public as $$
declare
  v_current_user uuid := auth.uid();
  v_room_type    text;
  v_target       text;
begin
  if v_current_user is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_room_member(p_room_id, v_current_user) then
    raise exception 'Not a member of this room';
  end if;

  select room_type into v_room_type
  from public.rooms
  where id = p_room_id;

  if v_room_type = 'direct' then
    -- 수신자 id가 없으면 자동으로 상대방 조회
    if p_to_user_id is null then
      select user_id into p_to_user_id
      from public.room_members
      where room_id = p_room_id
        and user_id != v_current_user
      limit 1;
    end if;

    -- 1) 발신자가 수신자별로 설정한 언어 우선
    select target_language into v_target
    from public.translation_preferences
    where from_user_id = v_current_user
      and to_user_id   = p_to_user_id;

    if v_target is not null then
      return v_target;
    end if;

    -- 2) 수신자의 기본 언어 fallback
    select preferred_language into v_target
    from public.profiles
    where id = p_to_user_id;

    return coalesce(v_target, 'en');

  else
    -- 그룹방: 방의 default 언어
    select default_translation_language into v_target
    from public.rooms
    where id = p_room_id;

    return coalesce(v_target, 'en');
  end if;
end;
$$;

revoke all   on function public.get_target_language(uuid, uuid) from public;
grant execute on function public.get_target_language(uuid, uuid) to authenticated;
