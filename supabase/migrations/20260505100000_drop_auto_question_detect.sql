-- "?" 및 키워드 기반 자동 질문 감지 트리거 제거
-- needs_response는 사용자가 토글로 명시적으로 설정한 경우에만 true
drop trigger if exists trg_detect_question on public.messages;
drop function if exists public.detect_question_message();
