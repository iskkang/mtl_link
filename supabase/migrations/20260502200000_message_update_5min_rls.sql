drop policy if exists "messages_update_own" on public.messages;

create policy "messages_update_own_5min" on public.messages
  for update to authenticated
  using (
    sender_id = auth.uid()
    and deleted_at is null
    and created_at > now() - interval '5 minutes'
    and message_type = 'text'
  )
  with check (sender_id = auth.uid());
