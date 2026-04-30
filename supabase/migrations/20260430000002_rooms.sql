create table public.rooms (
  id              uuid primary key default gen_random_uuid(),
  room_type       text not null check (room_type in ('direct', 'group')),
  name            text,
  created_by      uuid references public.profiles(id) on delete set null,
  last_message    text,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint group_room_name_required check (
    (room_type = 'group' and name is not null and length(trim(name)) > 0)
    or (room_type = 'direct')
  )
);
