-- rooms에 그룹방 기본 번역 도착어 컬럼 추가
alter table public.rooms
  add column if not exists default_translation_language text
    check (
      default_translation_language in ('ko', 'en', 'ru', 'zh', 'ja', 'uz')
      or default_translation_language is null
    );

comment on column public.rooms.default_translation_language
  is '그룹방의 기본 번역 도착어. 1:1 방에서는 NULL';
