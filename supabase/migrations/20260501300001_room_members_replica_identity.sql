-- room_members DELETE 이벤트에서 room_id/user_id를 포함하기 위해 필요
alter table public.room_members replica identity full;
