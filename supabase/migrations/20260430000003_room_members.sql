create table public.room_members (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member'
                check (role in ('owner', 'admin', 'member')),
  joined_at   timestamptz not null default now(),
  last_read_at timestamptz,
  is_muted    boolean not null default false,
  is_pinned   boolean not null default false,
  unique(room_id, user_id)
);
