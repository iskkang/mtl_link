-- messages에 번역 관련 컬럼 추가
alter table public.messages
  add column if not exists content_original    text,
  add column if not exists source_language     text
    check (source_language is null or source_language in ('ko', 'en', 'ru', 'zh', 'ja', 'uz')),
  add column if not exists target_language     text
    check (target_language is null or target_language in ('ko', 'en', 'ru', 'zh', 'ja', 'uz')),
  add column if not exists translation_provider text
    check (translation_provider is null or translation_provider in ('claude', 'openai', 'google', 'deepl'));

-- voice_translated / text_translated 타입 메시지는 반드시 원본·언어 정보 필요
alter table public.messages
  add constraint translation_metadata_required check (
    message_type not in ('voice_translated', 'text_translated')
    or (
      content_original  is not null
      and source_language  is not null
      and target_language  is not null
    )
  );

comment on column public.messages.content_original    is 'STT 원본 또는 번역 전 원문. 번역 없으면 NULL';
comment on column public.messages.source_language     is '원본 언어 코드';
comment on column public.messages.target_language     is '번역된 언어 코드';
comment on column public.messages.translation_provider is '번역에 사용된 서비스';

-- update_room_last_message 함수 교체 — voice_translated 케이스 추가
create or replace function public.update_room_last_message()
returns trigger language plpgsql as $$
declare
  v_preview text;
begin
  case new.message_type
    when 'text'             then v_preview := left(coalesce(new.content, ''), 100);
    when 'image'            then v_preview := '📷 사진';
    when 'file'             then v_preview := '📎 파일';
    when 'link'             then v_preview := left(coalesce(new.content, '🔗 링크'), 100);
    when 'voice_translated' then v_preview := '🎤 ' || left(coalesce(new.content, ''), 80);
    when 'text_translated'  then v_preview := left(coalesce(new.content, ''), 100);
    when 'system'           then v_preview := left(coalesce(new.content, ''), 100);
    else                         v_preview := left(coalesce(new.content, ''), 100);
  end case;

  update public.rooms
  set last_message    = v_preview,
      last_message_at = new.created_at,
      updated_at      = now()
  where id = new.room_id;

  return new;
end;
$$;
