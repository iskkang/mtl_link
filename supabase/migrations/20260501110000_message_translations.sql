-- message_translations: lazy per-language translation cache
create table public.message_translations (
  id              uuid        primary key default gen_random_uuid(),
  message_id      uuid        not null references public.messages(id) on delete cascade,
  room_id         uuid        not null references public.rooms(id) on delete cascade,
  language        text        not null check (language in ('ko','en','ru','uz','zh','ja')),
  translated_text text        not null,
  created_at      timestamptz not null default now(),
  unique(message_id, language)
);

create index idx_msg_translations_message on public.message_translations(message_id);

alter table public.message_translations enable row level security;

create policy "translations_select_member" on public.message_translations
  for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));

create policy "translations_insert_member" on public.message_translations
  for insert to authenticated
  with check (public.is_room_member(room_id, auth.uid()));
