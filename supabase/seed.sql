-- ─────────────────────────────────────────────────────────────────────────────
-- MTL Link — Seed Data
-- 첫 관리자 계정은 Supabase 대시보드 → Authentication → Users 에서 직접 생성 후
-- 아래 SQL을 대시보드 SQL Editor에서 실행해 관리자 권한을 부여하세요.
-- ─────────────────────────────────────────────────────────────────────────────

-- [사용 방법]
-- 1. Supabase 대시보드 → Authentication → Users → "Add user" → 이메일/비밀번호 입력
-- 2. 아래 이메일 주소를 실제 관리자 이메일로 변경 후 실행
-- 3. must_change_password = false 로 설정해 관리자는 비밀번호 변경 화면 skip

update public.profiles
set
  is_admin             = true,
  must_change_password = false,
  name                 = '관리자',        -- 실제 이름으로 변경
  department           = '관리',
  position             = '관리자'
where email = 'admin@example.com';      -- ← 실제 관리자 이메일로 변경

-- 변경 확인
select id, email, name, is_admin, must_change_password
from public.profiles
where is_admin = true;
