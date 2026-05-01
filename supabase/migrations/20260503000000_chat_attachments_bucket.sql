-- Public bucket: chat-attachments
-- public=true 로 서명 URL 없이 직접 접근 가능
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 누구나 읽기 (public bucket)
DROP POLICY IF EXISTS "chat_attachments_select_public" ON storage.objects;
CREATE POLICY "chat_attachments_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'chat-attachments');

-- Storage RLS: 방 멤버만 업로드 (경로: {room_id}/...)
DROP POLICY IF EXISTS "chat_attachments_insert_member" ON storage.objects;
CREATE POLICY "chat_attachments_insert_member" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.is_room_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

-- Storage RLS: 업로더만 삭제
DROP POLICY IF EXISTS "chat_attachments_delete_owner" ON storage.objects;
CREATE POLICY "chat_attachments_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND owner = auth.uid());

-- attachment_type 체크 제약 확장: video / other 추가
ALTER TABLE public.message_attachments
  DROP CONSTRAINT IF EXISTS message_attachments_attachment_type_check;

ALTER TABLE public.message_attachments
  ADD CONSTRAINT message_attachments_attachment_type_check
    CHECK (attachment_type IN ('image', 'video', 'document', 'archive', 'other'));
