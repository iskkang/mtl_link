-- auth.users 신규 가입 시 profiles 자동 생성
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- profiles updated_at 자동 갱신
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- rooms updated_at 자동 갱신
create trigger trg_rooms_updated_at
  before update on public.rooms
  for each row execute function public.update_updated_at_column();

-- 메시지 INSERT 시 rooms.last_message 갱신
create trigger trg_messages_update_room
  after insert on public.messages
  for each row execute function public.update_room_last_message();
