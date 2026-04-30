-- ─── RLS 활성화 ──────────────────────────────────────────────────────────────
alter table public.profiles           enable row level security;
alter table public.rooms              enable row level security;
alter table public.room_members       enable row level security;
alter table public.messages           enable row level security;
alter table public.message_attachments enable row level security;


-- ─── profiles ────────────────────────────────────────────────────────────────
-- 로그인한 사용자는 전체 프로필 조회 가능 (직원 목록 표시용)
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

-- 본인 프로필만 수정 가능
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ─── rooms ───────────────────────────────────────────────────────────────────
-- 참여한 방만 조회 가능
create policy "rooms_select_member" on public.rooms
  for select to authenticated
  using (public.is_room_member(id, auth.uid()));

-- owner/admin만 방 정보 수정 가능
create policy "rooms_update_owner" on public.rooms
  for update to authenticated
  using (
    exists (
      select 1 from public.room_members
      where room_id = rooms.id and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.room_members
      where room_id = rooms.id and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- owner만 방 삭제 가능
create policy "rooms_delete_owner" on public.rooms
  for delete to authenticated
  using (
    exists (
      select 1 from public.room_members
      where room_id = rooms.id and user_id = auth.uid()
        and role = 'owner'
    )
  );


-- ─── room_members ─────────────────────────────────────────────────────────────
-- 같은 방 멤버만 서로 조회 가능
create policy "room_members_select_visible" on public.room_members
  for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));

-- owner/admin만 멤버 추가 가능
create policy "room_members_insert_owner_admin" on public.room_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = room_members.room_id
        and rm.user_id = auth.uid()
        and rm.role in ('owner', 'admin')
    )
  );

-- 본인 멤버십 정보만 수정 가능 (last_read_at, is_muted, is_pinned)
create policy "room_members_update_self" on public.room_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 본인 퇴장 또는 owner/admin이 강퇴 가능
create policy "room_members_delete" on public.room_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.room_members rm
      where rm.room_id = room_members.room_id
        and rm.user_id = auth.uid()
        and rm.role in ('owner', 'admin')
    )
  );


-- ─── messages ────────────────────────────────────────────────────────────────
-- 참여한 방의 메시지만 조회 가능
create policy "messages_select_member" on public.messages
  for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));

-- 본인 이름으로, 참여한 방에만 전송 가능
create policy "messages_insert_member" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_room_member(room_id, auth.uid())
  );

-- 본인 메시지만 수정 가능 (soft delete용 deleted_at 포함)
create policy "messages_update_own" on public.messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- 본인 메시지만 삭제 가능
create policy "messages_delete_own" on public.messages
  for delete to authenticated
  using (sender_id = auth.uid());


-- ─── message_attachments ─────────────────────────────────────────────────────
-- 참여한 방의 첨부파일만 조회 가능
create policy "attachments_select_member" on public.message_attachments
  for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));

-- 본인이 올린, 본인 메시지에 연결된 첨부파일만 등록 가능
create policy "attachments_insert_own_message" on public.message_attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.is_room_member(room_id, auth.uid())
    and exists (
      select 1 from public.messages m
      where m.id = message_attachments.message_id
        and m.sender_id = auth.uid()
    )
  );

-- 본인이 올린 첨부파일만 삭제 가능
create policy "attachments_delete_own" on public.message_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid());
