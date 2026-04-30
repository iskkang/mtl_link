-- leave_room: SECURITY DEFINER so system message can bypass messages_insert_member RLS
create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name    text;
  v_type    text;
begin
  if not exists (
    select 1 from room_members where room_id = p_room_id and user_id = v_user_id
  ) then
    raise exception 'not_a_member';
  end if;

  select room_type into v_type from rooms   where id = p_room_id;
  select name      into v_name from profiles where id = v_user_id;

  if v_type = 'group' then
    insert into messages (room_id, sender_id, message_type, content)
    values (p_room_id, null, 'system', v_name || '님이 나갔습니다');
  end if;

  delete from room_members where room_id = p_room_id and user_id = v_user_id;
end;
$$;

grant execute on function public.leave_room(uuid) to authenticated;
