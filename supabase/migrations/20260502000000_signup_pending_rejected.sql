-- ─── 1. profiles.status CHECK 제약 확장 ──────────────────────────────────────
alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check
    check (status in ('active', 'inactive', 'pending', 'rejected'));

-- ─── 2. handle_new_user 트리거 함수 교체 ──────────────────────────────────────
-- 관리자 초대(must_change_password=true in metadata) → status='active'
-- 자가 가입(metadata 없음)                           → status='pending'
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_admin_invite boolean;
begin
  v_admin_invite := coalesce(
    (new.raw_user_meta_data->>'must_change_password')::boolean,
    false
  );

  insert into public.profiles (
    id, email, name,
    department, position, preferred_language,
    must_change_password, status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'department', ''),
    nullif(new.raw_user_meta_data->>'position',   ''),
    coalesce(nullif(new.raw_user_meta_data->>'preferred_language', ''), 'ko'),
    v_admin_invite,
    case when v_admin_invite then 'active' else 'pending' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
