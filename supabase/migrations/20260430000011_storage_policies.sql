-- ─── chat-files ──────────────────────────────────────────────────────────────
-- 경로: chat-files/{room_id}/{message_id}/{timestamp}_{file_name}
-- (storage.foldername(name))[1] 이 room_id

-- 참여한 방의 파일만 다운로드 가능
create policy "chat_files_select_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-files'
    and public.is_room_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

-- 참여한 방에만 업로드 가능
create policy "chat_files_insert_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-files'
    and public.is_room_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

-- 본인이 올린 파일만 삭제 가능
create policy "chat_files_delete_owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-files'
    and owner = auth.uid()
  );


-- ─── avatars ─────────────────────────────────────────────────────────────────
-- 경로: avatars/{user_id}/{timestamp}.{ext}

-- 로그인 사용자 + 비로그인 사용자 모두 조회 가능 (프로필 사진 공개)
create policy "avatars_select_all" on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'avatars');

-- 본인 폴더({user_id})에만 업로드 가능
create policy "avatars_insert_self" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 본인 폴더 파일만 수정 가능
create policy "avatars_update_self" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 본인 폴더 파일만 삭제 가능
create policy "avatars_delete_self" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
