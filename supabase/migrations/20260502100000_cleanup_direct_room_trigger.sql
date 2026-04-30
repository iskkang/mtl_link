create or replace function public.cleanup_empty_direct_room()
returns trigger
language plpgsql
security definer
as $$
declare
  v_room_type   text;
  v_member_count int;
begin
  select room_type into v_room_type
  from public.rooms
  where id = old.room_id;

  if v_room_type = 'direct' then
    select count(*) into v_member_count
    from public.room_members
    where room_id = old.room_id;

    if v_member_count < 2 then
      delete from public.rooms where id = old.room_id;
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_cleanup_direct_room on public.room_members;
create trigger trg_cleanup_direct_room
  after delete on public.room_members
  for each row execute function public.cleanup_empty_direct_room();
