-- translation_preferences RLS 정책
-- 본인이 설정한 항목(from_user_id = 본인)만 CRUD 가능

create policy "trans_prefs_select_self" on public.translation_preferences
  for select to authenticated
  using (from_user_id = auth.uid());

create policy "trans_prefs_insert_self" on public.translation_preferences
  for insert to authenticated
  with check (from_user_id = auth.uid());

create policy "trans_prefs_update_self" on public.translation_preferences
  for update to authenticated
  using (from_user_id = auth.uid())
  with check (from_user_id = auth.uid());

create policy "trans_prefs_delete_self" on public.translation_preferences
  for delete to authenticated
  using (from_user_id = auth.uid());
