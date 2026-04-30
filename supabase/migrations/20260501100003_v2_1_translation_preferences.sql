-- 발신자가 특정 수신자에게 보낼 때 사용할 번역 도착어 설정 테이블
create table public.translation_preferences (
  id               uuid primary key default gen_random_uuid(),
  from_user_id     uuid not null references public.profiles(id) on delete cascade,
  to_user_id       uuid not null references public.profiles(id) on delete cascade,
  target_language  text not null
    check (target_language in ('ko', 'en', 'ru', 'zh', 'ja', 'uz', 'none')),
  -- 'none' = 이 사람에게는 번역하지 않음
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(from_user_id, to_user_id),
  constraint not_self check (from_user_id != to_user_id)
);

comment on table public.translation_preferences
  is '발신자가 특정 수신자에게 메시지 보낼 때 사용할 번역 도착어 설정';

alter table public.translation_preferences enable row level security;

-- updated_at 자동 갱신 트리거
create trigger trg_trans_prefs_updated_at
  before update on public.translation_preferences
  for each row execute function public.update_updated_at_column();

-- 조회 성능용 인덱스
create index idx_trans_prefs_from_user
  on public.translation_preferences(from_user_id);
