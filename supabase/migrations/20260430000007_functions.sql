-- ─────────────────────────────────────────────────────────────────────────────
-- 1. updated_at 자동 갱신 트리거용 함수
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS 무한 재귀 방지 — rooms ↔ room_members 순환 참조 우회
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

revoke all   on function public.is_room_member(uuid, uuid) from public;
grant execute on function public.is_room_member(uuid, uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 1:1 방 중복 방지 — 항상 동일 방 반환
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_or_create_direct_room(p_target_user_id uuid)
returns uuid
language plpgsql security definer
set search_path = public as $$
declare
  v_current_user uuid := auth.uid();
  v_room_id      uuid;
begin
  if v_current_user is null then
    raise exception 'Not authenticated';
  end if;
  if v_current_user = p_target_user_id then
    raise exception 'Cannot create direct room with yourself';
  end if;

  -- 이미 존재하는 1:1 방 조회
  select r.id into v_room_id
  from public.rooms r
  where r.room_type = 'direct'
    and exists (
      select 1 from public.room_members
      where room_id = r.id and user_id = v_current_user
    )
    and exists (
      select 1 from public.room_members
      where room_id = r.id and user_id = p_target_user_id
    )
    and (select count(*) from public.room_members where room_id = r.id) = 2
  limit 1;

  if v_room_id is not null then
    return v_room_id;
  end if;

  -- 없으면 신규 생성
  insert into public.rooms (room_type, created_by)
  values ('direct', v_current_user)
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id, role) values
    (v_room_id, v_current_user,    'member'),
    (v_room_id, p_target_user_id,  'member');

  return v_room_id;
end;
$$;

revoke all   on function public.get_or_create_direct_room(uuid) from public;
grant execute on function public.get_or_create_direct_room(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 그룹방 생성 — 생성자를 owner로 등록
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_group_room(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql security definer
set search_path = public as $$
declare
  v_current_user uuid := auth.uid();
  v_room_id      uuid;
  v_member_id    uuid;
begin
  if v_current_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Group name is required';
  end if;

  insert into public.rooms (room_type, name, created_by)
  values ('group', trim(p_name), v_current_user)
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id, role)
  values (v_room_id, v_current_user, 'owner');

  foreach v_member_id in array p_member_ids loop
    if v_member_id != v_current_user then
      insert into public.room_members (room_id, user_id, role)
      values (v_room_id, v_member_id, 'member')
      on conflict (room_id, user_id) do nothing;
    end if;
  end loop;

  return v_room_id;
end;
$$;

revoke all   on function public.create_group_room(text, uuid[]) from public;
grant execute on function public.create_group_room(text, uuid[]) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 메시지 insert 시 rooms.last_message 자동 갱신
--    (v2.1 마이그레이션에서 voice_translated 케이스 추가로 교체됨)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.update_room_last_message()
returns trigger language plpgsql as $$
declare
  v_preview text;
begin
  case new.message_type
    when 'text'   then v_preview := left(coalesce(new.content, ''), 100);
    when 'image'  then v_preview := '📷 사진';
    when 'file'   then v_preview := '📎 파일';
    when 'link'   then v_preview := left(coalesce(new.content, '🔗 링크'), 100);
    when 'system' then v_preview := left(coalesce(new.content, ''), 100);
    else               v_preview := left(coalesce(new.content, ''), 100);
  end case;

  update public.rooms
  set last_message    = v_preview,
      last_message_at = new.created_at,
      updated_at      = now()
  where id = new.room_id;

  return new;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. auth.users INSERT → profiles 자동 동기화
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, email, name, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
