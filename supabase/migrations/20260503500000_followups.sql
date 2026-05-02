-- messages 테이블에 follow-up 관련 컬럼 추가
alter table public.messages
  add column needs_response       boolean     default false,
  add column response_received    boolean     default false,
  add column followup_reminded_at timestamptz;

-- 답변 대기 메시지를 빠르게 조회하기 위한 부분 인덱스
create index idx_messages_needs_response
  on public.messages(sender_id, created_at)
  where needs_response = true
    and response_received = false
    and deleted_at is null;

-- ──────────────────────────────────────────────────────────────────────────
-- 자동 질문 감지 트리거 (INSERT 전)
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.detect_question_message()
returns trigger language plpgsql as $$
begin
  -- text 메시지만 처리
  if new.message_type != 'text' then
    return new;
  end if;

  -- 사용자가 이미 명시적으로 설정한 경우 그대로 유지
  if new.needs_response = true then
    return new;
  end if;

  -- 다국어 질문 키워드 자동 감지
  if new.content ~ '\?|？'
     or new.content ilike '%부탁%'
     or new.content ilike '%해주세요%'
     or new.content ilike '%해줘%'
     or new.content ilike '%알려%'
     or new.content ilike '%확인%'
     or new.content ilike '%please%'
     or new.content ilike '%could you%'
     or new.content ilike '%can you%'
     or new.content ilike '%пожалуйста%'
     or new.content ilike '%сообщите%'
     or new.content ilike '%iltimos%'
     or new.content ilike '%请%'
     or new.content ilike '%お願い%'
  then
    new.needs_response := true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_detect_question on public.messages;
create trigger trg_detect_question
  before insert on public.messages
  for each row execute function public.detect_question_message();

-- ──────────────────────────────────────────────────────────────────────────
-- 답변 자동 감지 트리거 (INSERT 후)
-- 같은 방에서 다른 사람이 메시지를 보내면 해당 사람의 미답변 메시지를 해제
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.mark_responses_received()
returns trigger language plpgsql as $$
begin
  -- text 메시지만 처리
  if new.message_type != 'text' then
    return new;
  end if;

  -- 같은 방에서 발신자가 다른 사람의 미답변 메시지를 응답받음으로 표시
  update public.messages
  set response_received = true
  where room_id          = new.room_id
    and sender_id       != new.sender_id
    and needs_response   = true
    and response_received = false
    and deleted_at       is null
    and created_at       < new.created_at;

  return new;
end;
$$;

drop trigger if exists trg_mark_responses on public.messages;
create trigger trg_mark_responses
  after insert on public.messages
  for each row execute function public.mark_responses_received();
