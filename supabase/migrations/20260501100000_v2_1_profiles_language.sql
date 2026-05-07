-- profiles에 선호 언어 컬럼 추가
-- 음성번역 시 수신자 언어 fallback에 사용
alter table public.profiles
  add column if not exists preferred_language text not null default 'en'
    check (preferred_language in ('ko', 'en', 'ru', 'zh', 'ja', 'uz'));

comment on column public.profiles.preferred_language
  is '사용자가 받고 싶어하는 기본 언어. 음성번역 fallback에 사용';
