-- 방 목록 정렬용
create index idx_rooms_last_message_at
  on public.rooms(last_message_at desc nulls last);

-- 사용자별 방 조회용
create index idx_room_members_user_id on public.room_members(user_id);
create index idx_room_members_room_id on public.room_members(room_id);

-- 메시지 페이지네이션용
create index idx_messages_room_created
  on public.messages(room_id, created_at desc);
create index idx_messages_sender_id
  on public.messages(sender_id);
create index idx_messages_not_deleted
  on public.messages(room_id, created_at desc)
  where deleted_at is null;

-- 첨부파일 조회용
create index idx_attachments_message_id on public.message_attachments(message_id);
create index idx_attachments_room_id    on public.message_attachments(room_id);

-- 메시지 전문 검색용 (v1.5 대비 미리 준비)
create index idx_messages_content_trgm
  on public.messages using gin (content gin_trgm_ops);
