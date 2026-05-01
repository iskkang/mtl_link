# MTL Link DB 설계서

> v1 원본 → v2 보강 → v2.1 음성번역 → v2.2 추가 기능 스키마까지 통합한 최종본.
> 최종 업데이트: 2026-05-02

---

## 0. 현재 마이그레이션 적용 현황 (2026-05-02 기준)

총 **28개** 마이그레이션 파일 적용 완료.

| 범위 | 파일 수 | 주요 내용 |
|---|---:|---|
| 기반 v2 | 12개 | profiles~storage_policies |
| 음성번역 v2.1 | 6개 | 언어 컬럼, translation_preferences |
| v1.5·v2.2 확장 | 10개 | signup, reply, read_receipts, OCR번역, 텍스트번역 등 |

---

## 0-1. 버전별 변경 이력

| 항목 | v1 원본 | v2 보강 | v2.1 추가 | v2.2 추가 (현재) |
|---|---|---|---|---|
| DB 트리거 | 언급 없음 | 6개 트리거 | `translation_preferences` updated_at 트리거 추가 | 1:1 방 자동 정리 트리거 추가 |
| DB 함수 | 없음 | 6개 함수 | `get_target_language()` 추가 → **7개** | `leave_room()` 추가 → **8개** |
| RLS 정책 | 일부 예시 | 전 테이블 완비 | `translation_preferences` RLS 4개 추가 | `signup_requests`, `message_translations` 추가 |
| 무한 재귀 방지 | 없음 | `SECURITY DEFINER` 함수 | 동일 | 동일 |
| Storage RLS | 없음 | chat-files·avatars 정책 | 동일 | `chat-attachments` 버킷 추가 |
| `profiles` | 기본 컬럼 | `is_admin`, `must_change_password` | **`preferred_language` 추가** | 동일 |
| `rooms` | 기본 컬럼 | 동일 | **`default_translation_language` 추가** | 동일 |
| `messages` | 기본 컬럼 | `content_length_limit` 제약 | **`content_original`, `source_language`, `target_language`, `translation_provider` 추가** | **`reply_to_id` 추가** |
| `translation_preferences` | 없음 | 없음 | **신규 테이블** | 동일 |
| `signup_requests` | 없음 | 없음 | 없음 | **신규 테이블** (가입 신청·승인·거절) |
| `message_translations` | 없음 | 없음 | 없음 | **신규 테이블** (텍스트 자동 번역 캐시) |
| `room_members` Realtime | 없음 | 없음 | 없음 | **REPLICA IDENTITY FULL + publication** |
| 마이그레이션 구조 | 없음 | 11개 파일 | **17개 파일** (v2.1 6개 추가) | **28개 파일** (v2.2 11개 추가) |

---

## 1. 설계 개요

MoveTalk과는 **별도의 Supabase 프로젝트**로 운영한다. DB는 **Supabase Postgres**를 사용한다.

### 핵심 설계 원칙
1. 모든 비즈니스 규칙은 DB 레벨에서 강제한다 (트리거·함수·제약조건).
2. 클라이언트는 RLS를 신뢰하고 단순 CRUD만 호출한다.
3. 파일은 DB에 저장하지 않고 Storage에 저장한다.
4. 삭제는 `deleted_at` soft delete를 우선한다.
5. RLS 무한 재귀는 `SECURITY DEFINER` 함수로 우회한다.
6. **음성 파일은 DB·Storage 어디에도 저장하지 않는다** (Edge Function 메모리에서만 처리).

---

## 2. 전체 테이블 구조

| 테이블명 | 상태 | 목적 |
|---|---|---|
| profiles | ✅ 구현 완료 | 직원 프로필 |
| rooms | ✅ 구현 완료 | 채팅방 |
| room_members | ✅ 구현 완료 | 채팅방 참여자 (REPLICA IDENTITY FULL) |
| messages | ✅ 구현 완료 | 메시지 (번역·답장 컬럼 포함) |
| message_attachments | ✅ 구현 완료 | 첨부파일 |
| translation_preferences | ✅ 구현 완료 (v2.1) | 수신자별 번역 언어 설정 |
| message_links | ✅ 구현 완료 (v1.5) | 링크 OG 메타데이터 |
| signup_requests | ✅ 구현 완료 (v2.2) | 가입 신청 (pending/approved/rejected) |
| message_translations | ✅ 구현 완료 (v2.2) | 텍스트 자동 번역 캐시 |
| message_reactions | ⏳ 설계만 완료 (v3) | 메시지 이모지 반응 |
| message_mentions | ⏳ 설계만 완료 (v3) | @멘션 |
| read_receipts | ⏳ 설계만 완료 (v3) | 메시지별 개별 읽음 (현재는 last_read_at으로 처리) |

---

## 3. ERD 개념

```text
auth.users (Supabase 관리)
   │
   └── profiles (트리거로 자동 생성)
          │
          ├── room_members ─── rooms
          │                     │
          │                     └── messages ── message_attachments
          │
          ├── messages.sender_id
          │
          └── translation_preferences (from_user_id, to_user_id)
```

---

## 4. 테이블 상세

### 4.1 profiles

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  department text,
  position text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_admin boolean not null default false,
  must_change_password boolean not null default true,
  preferred_language text not null default 'ko'
    check (preferred_language in ('ko', 'en', 'ru', 'zh', 'ja', 'uz')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.is_admin is '관리자 여부. 직원 추가·비활성화 권한';
comment on column public.profiles.must_change_password is '첫 로그인 시 비밀번호 변경 필요 여부';
comment on column public.profiles.preferred_language is '사용자가 받고 싶어하는 기본 언어. 음성번역 fallback에 사용';
```

---

### 4.2 rooms

```sql
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_type text not null check (room_type in ('direct', 'group')),
  name text,
  created_by uuid references public.profiles(id) on delete set null,
  last_message text,
  last_message_at timestamptz,
  default_translation_language text
    check (default_translation_language in ('ko', 'en', 'ru', 'zh', 'ja', 'uz') or default_translation_language is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_room_name_required check (
    (room_type = 'group' and name is not null and length(trim(name)) > 0)
    or (room_type = 'direct')
  )
);

comment on column public.rooms.default_translation_language is '그룹방의 기본 번역 도착어. 1:1 방에서는 NULL';
```

---

### 4.3 room_members

```sql
create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  is_muted boolean not null default false,
  is_pinned boolean not null default false,
  unique(room_id, user_id)
);
```

---

### 4.4 messages

```sql
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  message_type text not null default 'text'
    check (message_type in ('text', 'image', 'file', 'link', 'system', 'voice_translated', 'text_translated')),
  content text,
  content_original text,
  source_language text check (
    source_language is null or source_language in ('ko', 'en', 'ru', 'zh', 'ja', 'uz')
  ),
  target_language text check (
    target_language is null or target_language in ('ko', 'en', 'ru', 'zh', 'ja', 'uz')
  ),
  translation_provider text check (
    translation_provider is null or translation_provider in ('claude', 'openai', 'google', 'deepl')
  ),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint content_length_limit check (content is null or length(content) <= 4000),
  constraint translation_metadata_required check (
    message_type not in ('voice_translated', 'text_translated')
    or (content_original is not null and source_language is not null and target_language is not null)
  )
);

comment on column public.messages.content is '표시용 텍스트. voice_translated의 경우 번역된 텍스트';
comment on column public.messages.content_original is 'STT 원본 또는 번역 전 원문. 번역 없으면 NULL';
comment on column public.messages.source_language is '원본 언어 코드';
comment on column public.messages.target_language is '번역된 언어 코드';
comment on column public.messages.translation_provider is '번역에 사용된 서비스';
```

---

### 4.5 message_attachments

```sql
create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_size bigint not null default 0 check (file_size >= 0),
  mime_type text not null,
  attachment_type text not null check (attachment_type in ('image', 'document', 'archive')),
  created_at timestamptz not null default now()
);
```

---

### 4.6 translation_preferences (v2.1 신규)

```sql
create table public.translation_preferences (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  target_language text not null check (target_language in ('ko', 'en', 'ru', 'zh', 'ja', 'uz', 'none')),
  -- 'none'은 "이 사람에게는 번역하지 않음"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(from_user_id, to_user_id),
  constraint not_self check (from_user_id != to_user_id)
);

comment on table public.translation_preferences is
  '발신자가 특정 수신자에게 메시지 보낼 때 사용할 번역 도착어 설정';

create index idx_trans_prefs_from_user on public.translation_preferences(from_user_id);
```

---

## 5. 인덱스 설계

```sql
create extension if not exists pg_trgm;

-- 방 목록 정렬용
create index idx_rooms_last_message_at on public.rooms(last_message_at desc nulls last);

-- 사용자별 방 조회용
create index idx_room_members_user_id on public.room_members(user_id);
create index idx_room_members_room_id on public.room_members(room_id);

-- 메시지 페이지네이션용
create index idx_messages_room_created on public.messages(room_id, created_at desc);
create index idx_messages_sender_id on public.messages(sender_id);
create index idx_messages_not_deleted on public.messages(room_id, created_at desc) where deleted_at is null;

-- 첨부파일 조회용
create index idx_attachments_message_id on public.message_attachments(message_id);
create index idx_attachments_room_id on public.message_attachments(room_id);

-- 번역 설정 조회용
create index idx_trans_prefs_from_user on public.translation_preferences(from_user_id);

-- 검색용 (v1.5 대비 미리 준비)
create index idx_messages_content_trgm on public.messages using gin (content gin_trgm_ops);
```

---

## 6. DB 함수 (총 7개)

### 6.1 `update_updated_at_column()` — updated_at 자동 갱신

```sql
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

### 6.2 `is_room_member(p_room_id, p_user_id)` — RLS 무한 재귀 회피

`rooms` ↔ `room_members` RLS 정책 간 순환 참조를 막는 `SECURITY DEFINER` 함수.

```sql
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

revoke all on function public.is_room_member(uuid, uuid) from public;
grant execute on function public.is_room_member(uuid, uuid) to authenticated;
```

### 6.3 `get_or_create_direct_room(p_target_user_id)` — 1:1 방 중복 방지

```sql
create or replace function public.get_or_create_direct_room(p_target_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_current_user uuid := auth.uid();
  v_room_id uuid;
begin
  if v_current_user is null then raise exception 'Not authenticated'; end if;
  if v_current_user = p_target_user_id then raise exception 'Cannot create direct room with yourself'; end if;

  select r.id into v_room_id
  from public.rooms r
  where r.room_type = 'direct'
    and exists (select 1 from public.room_members where room_id = r.id and user_id = v_current_user)
    and exists (select 1 from public.room_members where room_id = r.id and user_id = p_target_user_id)
    and (select count(*) from public.room_members where room_id = r.id) = 2
  limit 1;

  if v_room_id is not null then return v_room_id; end if;

  insert into public.rooms (room_type, created_by) values ('direct', v_current_user) returning id into v_room_id;
  insert into public.room_members (room_id, user_id, role) values
    (v_room_id, v_current_user, 'member'),
    (v_room_id, p_target_user_id, 'member');

  return v_room_id;
end;
$$;

revoke all on function public.get_or_create_direct_room(uuid) from public;
grant execute on function public.get_or_create_direct_room(uuid) to authenticated;
```

### 6.4 `create_group_room(p_name, p_member_ids)` — 그룹방 생성

```sql
create or replace function public.create_group_room(p_name text, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_current_user uuid := auth.uid();
  v_room_id uuid;
  v_member_id uuid;
begin
  if v_current_user is null then raise exception 'Not authenticated'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Group name is required'; end if;

  insert into public.rooms (room_type, name, created_by)
  values ('group', trim(p_name), v_current_user) returning id into v_room_id;

  insert into public.room_members (room_id, user_id, role) values (v_room_id, v_current_user, 'owner');

  foreach v_member_id in array p_member_ids loop
    if v_member_id != v_current_user then
      insert into public.room_members (room_id, user_id, role)
      values (v_room_id, v_member_id, 'member')
      on conflict (room_id, user_id) do nothing;
    end if;
  end loop;

  return v_room_id;
end;
$$;

revoke all on function public.create_group_room(text, uuid[]) from public;
grant execute on function public.create_group_room(text, uuid[]) to authenticated;
```

### 6.5 `update_room_last_message()` — 트리거용 함수 (v2.1에서 voice_translated 케이스 추가)

```sql
create or replace function public.update_room_last_message()
returns trigger language plpgsql as $$
declare v_preview text;
begin
  case new.message_type
    when 'text'             then v_preview := left(coalesce(new.content, ''), 100);
    when 'image'            then v_preview := '📷 사진';
    when 'file'             then v_preview := '📎 파일';
    when 'link'             then v_preview := left(coalesce(new.content, '🔗 링크'), 100);
    when 'voice_translated' then v_preview := '🎤 ' || left(coalesce(new.content, ''), 80);
    when 'text_translated'  then v_preview := left(coalesce(new.content, ''), 100);
    when 'system'           then v_preview := left(coalesce(new.content, ''), 100);
    else v_preview := '';
  end case;

  update public.rooms
  set last_message = v_preview, last_message_at = new.created_at, updated_at = now()
  where id = new.room_id;

  return new;
end;
$$;
```

### 6.6 `handle_new_user()` — auth.users → profiles 자동 동기화

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
```

### 6.7 `get_target_language(p_room_id, p_to_user_id)` — 번역 도착어 결정 (v2.1 신규)

```sql
create or replace function public.get_target_language(p_room_id uuid, p_to_user_id uuid default null)
returns text language plpgsql security definer stable set search_path = public as $$
declare
  v_current_user uuid := auth.uid();
  v_room_type text;
  v_target text;
begin
  if v_current_user is null then raise exception 'Not authenticated'; end if;
  if not public.is_room_member(p_room_id, v_current_user) then raise exception 'Not a member of this room'; end if;

  select room_type into v_room_type from public.rooms where id = p_room_id;

  if v_room_type = 'direct' then
    if p_to_user_id is null then
      select user_id into p_to_user_id
      from public.room_members
      where room_id = p_room_id and user_id != v_current_user limit 1;
    end if;

    -- 1) 수신자별 개별 설정 우선
    select target_language into v_target
    from public.translation_preferences
    where from_user_id = v_current_user and to_user_id = p_to_user_id;
    if v_target is not null then return v_target; end if;

    -- 2) 수신자의 기본 언어 fallback
    select preferred_language into v_target from public.profiles where id = p_to_user_id;
    return coalesce(v_target, 'en');
  else
    -- 그룹방: 방의 default 언어
    select default_translation_language into v_target from public.rooms where id = p_room_id;
    return coalesce(v_target, 'en');
  end if;
end;
$$;

revoke all on function public.get_target_language(uuid, uuid) from public;
grant execute on function public.get_target_language(uuid, uuid) to authenticated;
```

---

## 7. 트리거 (총 5개)

### 7.1 auth.users → profiles 자동 생성

```sql
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 7.2 updated_at 자동 갱신

```sql
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger trg_rooms_updated_at
  before update on public.rooms
  for each row execute function public.update_updated_at_column();

create trigger trg_trans_prefs_updated_at
  before update on public.translation_preferences
  for each row execute function public.update_updated_at_column();
```

### 7.3 메시지 insert 시 rooms.last_message 갱신

```sql
create trigger trg_messages_update_room
  after insert on public.messages
  for each row execute function public.update_room_last_message();
```

---

## 8. RLS 활성화

```sql
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.translation_preferences enable row level security;
```

---

## 9. RLS 정책 전체

### 9.1 profiles

```sql
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
```

> insert는 트리거로만, delete는 auth.users cascade로만 처리.

### 9.2 rooms

```sql
create policy "rooms_select_member" on public.rooms
  for select to authenticated using (public.is_room_member(id, auth.uid()));

create policy "rooms_update_owner" on public.rooms
  for update to authenticated
  using (exists (select 1 from public.room_members where room_id = rooms.id and user_id = auth.uid() and role in ('owner', 'admin')))
  with check (exists (select 1 from public.room_members where room_id = rooms.id and user_id = auth.uid() and role in ('owner', 'admin')));

create policy "rooms_delete_owner" on public.rooms
  for delete to authenticated
  using (exists (select 1 from public.room_members where room_id = rooms.id and user_id = auth.uid() and role = 'owner'));
```

### 9.3 room_members

```sql
create policy "room_members_select_visible" on public.room_members
  for select to authenticated using (public.is_room_member(room_id, auth.uid()));

create policy "room_members_insert_owner_admin" on public.room_members
  for insert to authenticated
  with check (exists (select 1 from public.room_members rm where rm.room_id = room_members.room_id and rm.user_id = auth.uid() and rm.role in ('owner', 'admin')));

create policy "room_members_update_self" on public.room_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "room_members_delete" on public.room_members
  for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.room_members rm where rm.room_id = room_members.room_id and rm.user_id = auth.uid() and rm.role in ('owner', 'admin')));
```

### 9.4 messages

```sql
create policy "messages_select_member" on public.messages
  for select to authenticated using (public.is_room_member(room_id, auth.uid()));

create policy "messages_insert_member" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_room_member(room_id, auth.uid()));

create policy "messages_update_own" on public.messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create policy "messages_delete_own" on public.messages
  for delete to authenticated using (sender_id = auth.uid());
```

### 9.5 message_attachments

```sql
create policy "attachments_select_member" on public.message_attachments
  for select to authenticated using (public.is_room_member(room_id, auth.uid()));

create policy "attachments_insert_own_message" on public.message_attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid() and public.is_room_member(room_id, auth.uid())
    and exists (select 1 from public.messages m where m.id = message_attachments.message_id and m.sender_id = auth.uid()));

create policy "attachments_delete_own" on public.message_attachments
  for delete to authenticated using (uploaded_by = auth.uid());
```

### 9.6 translation_preferences (v2.1)

```sql
create policy "trans_prefs_select_self" on public.translation_preferences
  for select to authenticated using (from_user_id = auth.uid());

create policy "trans_prefs_insert_self" on public.translation_preferences
  for insert to authenticated with check (from_user_id = auth.uid());

create policy "trans_prefs_update_self" on public.translation_preferences
  for update to authenticated using (from_user_id = auth.uid()) with check (from_user_id = auth.uid());

create policy "trans_prefs_delete_self" on public.translation_preferences
  for delete to authenticated using (from_user_id = auth.uid());
```

---

## 10. Storage 설계

### 10.1 Bucket

| Bucket | 접근 | 목적 |
|---|---|---|
| `chat-files` | private | 메시지 첨부파일. Signed URL로만 접근 |
| `avatars` | public read | 프로필 사진 |

### 10.2 경로 규칙

```text
chat-files/{room_id}/{message_id}/{timestamp}_{original_file_name}
avatars/{user_id}/{timestamp}.{ext}
```

---

## 11. Storage RLS 정책

### 11.1 chat-files

```sql
create policy "chat_files_select_member" on storage.objects for select to authenticated
  using (bucket_id = 'chat-files' and public.is_room_member((storage.foldername(name))[1]::uuid, auth.uid()));

create policy "chat_files_insert_member" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and public.is_room_member((storage.foldername(name))[1]::uuid, auth.uid()));

create policy "chat_files_delete_owner" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-files' and owner = auth.uid());
```

### 11.2 avatars

```sql
create policy "avatars_select_all" on storage.objects for select to authenticated, anon
  using (bucket_id = 'avatars');

create policy "avatars_insert_self" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_self" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_self" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
```

---

## 12. 파일 업로드 정책

| 항목 | 기준 |
|---|---:|
| 이미지 최대 | 10MB |
| 문서 최대 | 30MB |
| 압축파일 최대 | 50MB |
| 한 메시지 첨부 수 | 최대 5개 |

```text
허용: jpg, jpeg, png, webp, pdf, doc, docx, xls, xlsx, csv, ppt, pptx, zip
차단: exe, bat, cmd, js, msi, scr, ps1, vbs, sh, jar, com
```

클라이언트 검증 + DB CHECK + Storage 정책으로 3중 방어. MIME 타입 화이트리스트도 추가.

---

## 13. Edge Functions (총 6개)

### 13.1 admin-create-user
직원 추가 (Auth user 생성 + 임시 비밀번호 발급). Service Role Key 사용.

처리 흐름: 관리자 검증 → `auth.admin.createUser()` → 임시 비밀번호 → 메일 발송

### 13.2 voice-translate (v2.1)
음성 파일 → STT(Whisper) → 번역(Claude Haiku) → 텍스트 반환. 음성 파일 메모리에서 즉시 폐기.

### 13.3 translate-text (v2.2 신규)
텍스트 메시지 자동 번역. 수신자 언어 ≠ 발신 언어일 때 클라이언트에서 호출.

```text
supabase/functions/translate-text/index.ts
```

처리 흐름: 인증 → 방 멤버 검증 → Claude Haiku 번역 → 결과 반환

### 13.4 ocr-translate (v2.2 신규)
이미지 파일 → OCR(Claude Vision) → 번역 → `text_translated` 메시지 insert.

```text
supabase/functions/ocr-translate/index.ts
```

처리 흐름: 인증 → 이미지 검증(10MB·JPG/PNG/WEBP/GIF) → Claude Vision OCR → 번역 → 메시지 전송

### 13.5 fetch-link-preview (v1.5)
URL OG 메타데이터(제목·설명·이미지·도메인) 추출 → `message_links` 저장.

### 13.6 send-signup-notification (v2.2 신규)
신규 회원가입 신청 발생 시 관리자 이메일 알림 발송.

환경변수: `ADMIN_EMAIL` 필요.

### 필요한 Edge Function 시크릿 (전체)

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # admin-create-user, signup-notification
OPENAI_API_KEY=...              # voice-translate Whisper
ANTHROPIC_API_KEY=...           # voice-translate, translate-text, ocr-translate
ADMIN_EMAIL=...                 # send-signup-notification
```

---

## 14. 마이그레이션 파일 구조 (현재 적용 완료)

```text
supabase/
  migrations/
    # ─── 기반 (v2) ───────────────────────────────────────
    20260430000000_extensions.sql
    20260430000001_profiles.sql
    20260430000002_rooms.sql
    20260430000003_room_members.sql
    20260430000004_messages.sql
    20260430000005_attachments.sql
    20260430000006_indexes.sql
    20260430000007_functions.sql          # 함수 6개 (v2)
    20260430000008_triggers.sql           # 트리거 4개 (v2)
    20260430000009_rls_policies.sql       # RLS 전체 (v2)
    20260430000010_storage_buckets.sql
    20260430000011_storage_policies.sql
    # ─── 음성번역 추가 (v2.1) ────────────────────────────
    20260501100000_v2_1_profiles_language.sql
    20260501100001_v2_1_rooms_translation.sql
    20260501100002_v2_1_messages_translation.sql
    20260501100003_v2_1_translation_preferences.sql
    20260501100004_v2_1_get_target_language_fn.sql
    20260501100005_v2_1_translation_rls.sql
    # ─── v1.5 · v2.2 확장 ────────────────────────────────
    20260501110000_message_translations.sql       # 텍스트 자동 번역 캐시 테이블
    20260501200000_admin_profile_policy.sql       # 관리자 프로필 RLS 수정
    20260501300000_leave_room_fn.sql              # leave_room() 함수
    20260501300001_room_members_replica_identity.sql  # REPLICA IDENTITY FULL
    20260502000000_signup_pending_rejected.sql    # 가입 신청 signup_requests 테이블
    20260502100000_cleanup_direct_room_trigger.sql    # 1:1 방 자동 정리 (1차)
    20260502200000_message_update_5min_rls.sql    # 메시지 수정 5분 RLS
    20260502300000_reply_to_message.sql           # messages.reply_to_id 컬럼
    20260502400000_cleanup_direct_room_trigger.sql    # 1:1 방 자동 정리 (보완)
    20260502500000_room_members_realtime_publication.sql  # Realtime publication
    20260503000000_chat_attachments_bucket.sql    # chat-attachments Storage 버킷
  functions/
    admin-create-user/index.ts
    voice-translate/
      index.ts
      providers/whisper.ts
      providers/claude.ts
    translate-text/index.ts               # 텍스트 자동 번역 (v2.2)
    ocr-translate/index.ts                # OCR + 번역 (v2.2)
    fetch-link-preview/index.ts           # 링크 OG 메타 추출 (v1.5)
    send-signup-notification/index.ts     # 가입 신청 관리자 알림 (v2.2)
  seed.sql
```

---

## 15. 자주 사용되는 쿼리 예시

### 방 목록 (읽지 않은 메시지 카운트 포함)

```sql
select r.id, r.room_type, r.name, r.last_message, r.last_message_at,
       rm.last_read_at, rm.is_pinned,
  (select count(*) from public.messages m
   where m.room_id = r.id and m.deleted_at is null
     and (rm.last_read_at is null or m.created_at > rm.last_read_at)
     and m.sender_id != auth.uid()) as unread_count
from public.rooms r
join public.room_members rm on rm.room_id = r.id
where rm.user_id = auth.uid()
order by rm.is_pinned desc, r.last_message_at desc nulls last;
```

### 메시지 조회 (번역 컬럼 포함, 페이지네이션)

```sql
select m.id, m.message_type, m.content, m.content_original,
       m.source_language, m.target_language, m.created_at, m.edited_at,
       p.name as sender_name, p.avatar_url as sender_avatar_url,
       coalesce(json_agg(json_build_object('id',a.id,'file_name',a.file_name,
         'file_path',a.file_path,'file_size',a.file_size,'mime_type',a.mime_type,
         'attachment_type',a.attachment_type) order by a.created_at)
         filter (where a.id is not null), '[]'::json) as attachments
from public.messages m
left join public.profiles p on p.id = m.sender_id
left join public.message_attachments a on a.message_id = m.id
where m.room_id = $1 and m.deleted_at is null
  and m.created_at < coalesce($2, now())
group by m.id, p.name, p.avatar_url
order by m.created_at desc limit 50;
```

### 수신자별 번역 언어 설정 upsert

```sql
insert into public.translation_preferences (from_user_id, to_user_id, target_language)
values (auth.uid(), $1, $2)
on conflict (from_user_id, to_user_id)
do update set target_language = excluded.target_language, updated_at = now();
```

### 번역 도착어 조회

```sql
select public.get_target_language($1);  -- room_id
```

---

## 16. 메시지 전송 처리 흐름

### 16.1 텍스트 메시지
1. `messages` insert → RLS 통과
2. 트리거 `trg_messages_update_room`이 `rooms.last_message` 자동 갱신
3. Realtime broadcast

### 16.2 파일 메시지
1. 파일 검증 (확장자·MIME·크기)
2. `messages` insert → `message.id` 획득
3. Storage 업로드 (`chat-files/{room_id}/{message_id}/...`)
4. `message_attachments` insert
5. 트리거 갱신 → Realtime

> **순서 중요**: messages 먼저 insert해야 message_id를 알 수 있다.

### 16.3 음성 번역 메시지 (v2.1)
1. 클라이언트가 녹음 → Blob 생성
2. Edge Function `voice-translate` 호출 (FormData: audio + target_language + room_id)
3. Edge Function: Whisper STT → Claude 번역 → 음성 파일 메모리 폐기
4. 클라이언트: `messages` insert (`message_type='voice_translated'`, content=번역문, content_original=원문)
5. 트리거 갱신 → Realtime

---

## 17. Realtime 구독 기준

```text
방 메시지:  postgres_changes, table=messages,            filter=room_id=eq.<id>
첨부파일:   postgres_changes, table=message_attachments, filter=room_id=eq.<id>
방 목록:    postgres_changes, table=rooms
```

---

## 18. 구현 시 주의점

- 파일은 DB에 직접 저장하지 않는다 (Storage 사용).
- direct room은 반드시 `get_or_create_direct_room()` 함수로만 생성.
- **RLS는 처음부터 켠다** (나중에 켜면 쿼리 전부 깨짐).
- 삭제는 `deleted_at` soft delete 우선.
- 링크 미리보기는 v1에서 제외.
- Edge Function 시크릿 3개 모두 등록 후 배포.
- 마이그레이션은 SQL 에디터 직접 실행 금지 — `supabase/migrations/` 파일로만 관리.
- **음성 파일은 Edge Function 메모리에서만 처리, 절대 저장하지 않는다**.
- 민감 정보 음성 번역 사용 금지 운영 가이드 명시 필요.

---

## 19. v1.5 DB 확장 설계

### 19.1 message_reactions (메시지 반응)

```sql
create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

create policy "reactions_select_member" on public.message_reactions
  for select to authenticated using (public.is_room_member(room_id, auth.uid()));

create policy "reactions_insert_member" on public.message_reactions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id, auth.uid()));

create policy "reactions_delete_own" on public.message_reactions
  for delete to authenticated using (user_id = auth.uid());
```

---

### 19.2 message_threads (스레드 답글)

```sql
-- messages 테이블에 thread_id 컬럼 추가
alter table public.messages
  add column thread_id uuid references public.messages(id) on delete cascade,
  add column reply_count int not null default 0;

-- 인덱스
create index idx_messages_thread_id on public.messages(thread_id)
  where thread_id is not null;
```

스레드 구조:
- 원본 메시지: `thread_id = null`
- 답글: `thread_id = 원본 메시지 id`
- `reply_count`는 트리거로 자동 갱신

---

### 19.3 message_mentions (멘션)

```sql
create table public.message_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.message_mentions enable row level security;

create policy "mentions_select_self" on public.message_mentions
  for select to authenticated using (mentioned_user_id = auth.uid());

create policy "mentions_update_self" on public.message_mentions
  for update to authenticated using (mentioned_user_id = auth.uid());
```

---

### 19.4 message_links (링크 미리보기)

```sql
create table public.message_links (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  url text not null,
  title text,
  description text,
  image_url text,
  domain text,
  created_at timestamptz not null default now()
);

alter table public.message_links enable row level security;

create policy "links_select_member" on public.message_links
  for select to authenticated using (public.is_room_member(room_id, auth.uid()));
```

링크 미리보기는 `fetch-link-preview` Edge Function에서 OG 메타데이터 추출.

---

### 19.5 read_receipts (메시지별 읽음)

```sql
-- v1에서는 room_members.last_read_at으로 처리
-- v1.5에서 메시지별 읽음 표시가 필요하면 아래 테이블 추가

create table public.read_receipts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique(message_id, user_id)
);

alter table public.read_receipts enable row level security;

create policy "receipts_select_member" on public.read_receipts
  for select to authenticated using (public.is_room_member(room_id, auth.uid()));

create policy "receipts_insert_self" on public.read_receipts
  for insert to authenticated with check (user_id = auth.uid());
```

---

### 19.6 메시지 수정 정책

```sql
-- messages 테이블에 이미 edited_at 컬럼 있음
-- 5분 이내 수정만 허용하는 RLS 정책 업데이트

drop policy if exists "messages_update_own" on public.messages;

create policy "messages_update_own_5min" on public.messages
  for update to authenticated
  using (
    sender_id = auth.uid()
    and deleted_at is null
    and created_at > now() - interval '5 minutes'
  )
  with check (sender_id = auth.uid());
```

---

### 19.7 메시지 검색 인덱스

```sql
-- pg_trgm 인덱스 이미 v1에서 준비됨
-- 검색 함수 추가

create or replace function public.search_messages(
  p_query text,
  p_room_id uuid default null,
  p_limit int default 20
)
returns table (
  message_id uuid,
  room_id uuid,
  content text,
  sender_name text,
  created_at timestamptz
)
language sql security definer stable set search_path = public as $$
  select
    m.id,
    m.room_id,
    m.content,
    p.name,
    m.created_at
  from public.messages m
  join public.profiles p on p.id = m.sender_id
  where m.deleted_at is null
    and m.content ilike '%' || p_query || '%'
    and (p_room_id is null or m.room_id = p_room_id)
    and public.is_room_member(m.room_id, auth.uid())
  order by m.created_at desc
  limit p_limit;
$$;
```

---

## 20. 향후 확장

| 기능 | 추가 필요 |
|---|---|
| 텍스트 자동 번역 | message_type `text_translated` 이미 정의됨 |
| 그룹방 멤버별 언어 | translation_preferences에 room_id 컬럼 추가 |
| TTS | Edge Function + Storage |
| AI 요약 | room_summaries 테이블 |
| 음성/화상통화 | WebRTC, v3 이후 |
| 모바일 앱 | React Native 또는 PWA |
