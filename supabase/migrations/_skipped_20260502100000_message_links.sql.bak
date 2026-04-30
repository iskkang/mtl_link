create table if not exists public.message_links (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  url         text not null,
  title       text,
  description text,
  image_url   text,
  domain      text,
  created_at  timestamptz not null default now(),
  unique(message_id, url)
);

alter table public.message_links enable row level security;

drop policy if exists "links_select_member" on public.message_links;
create policy "links_select_member" on public.message_links
  for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));
