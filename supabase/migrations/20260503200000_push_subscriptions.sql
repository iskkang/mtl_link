create table public.push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_sub_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

create policy "push_sub_insert_own" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

create policy "push_sub_update_own" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid());

create policy "push_sub_delete_own" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());
