create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  sender_id    uuid references public.profiles(id) on delete set null,
  message_type text not null default 'text'
                 check (message_type in (
                   'text', 'image', 'file', 'link',
                   'system', 'voice_translated', 'text_translated'
                 )),
  content      text,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,
  deleted_at   timestamptz,
  constraint content_length_limit check (content is null or length(content) <= 4000)
);

comment on column public.messages.content is '표시용 텍스트. voice_translated의 경우 번역된 텍스트';
