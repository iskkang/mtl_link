create table public.message_attachments (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references public.messages(id) on delete cascade,
  room_id         uuid not null references public.rooms(id) on delete cascade,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  file_name       text not null,
  file_path       text not null,
  file_size       bigint not null default 0 check (file_size >= 0),
  mime_type       text not null,
  attachment_type text not null check (attachment_type in ('image', 'document', 'archive')),
  created_at      timestamptz not null default now()
);
