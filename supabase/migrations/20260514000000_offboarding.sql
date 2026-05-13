-- ============================================
-- PR 4: 4.3 멤버 퇴사 자동 정리
-- ============================================

-- 1. profiles에 비활성화 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_profiles_deactivated
  ON profiles(deactivated_at) WHERE deactivated_at IS NOT NULL;

-- 2. offboarding 결과 audit 테이블
CREATE TABLE IF NOT EXISTS offboarding_logs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES profiles(id),
  room_id                 UUID        NOT NULL REFERENCES rooms(id),
  pending_items           JSONB,
  notification_message_id UUID        REFERENCES messages(id),
  status                  TEXT        NOT NULL CHECK (status IN ('success','failed','no_items','removed_only')),
  error                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offboarding_logs_user
  ON offboarding_logs(user_id, created_at DESC);

ALTER TABLE offboarding_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view offboarding logs" ON offboarding_logs;
CREATE POLICY "Admin can view offboarding logs" ON offboarding_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 3. 퇴사 처리 trigger
CREATE OR REPLACE FUNCTION fn_trigger_member_offboarding()
RETURNS TRIGGER AS $$
DECLARE
  v_secret     TEXT;
  v_request_id BIGINT;
BEGIN
  -- NULL → 값으로 변경된 경우만 (재실행/다른 컬럼 UPDATE 무시)
  IF OLD.deactivated_at IS NOT NULL OR NEW.deactivated_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_briefing_secret'
  LIMIT 1;

  SELECT net.http_post(
    url     := 'https://zidkckbabtajpgkhxmfm.supabase.co/functions/v1/member-offboarding',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := jsonb_build_object(
      'user_id',        NEW.id,
      'deactivated_by', NEW.deactivated_by
    )
  ) INTO v_request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_trigger_member_offboarding IS
  'Triggers MINT offboarding summary when a member is deactivated.';

DROP TRIGGER IF EXISTS trg_member_offboarding ON profiles;
CREATE TRIGGER trg_member_offboarding
  AFTER UPDATE OF deactivated_at ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_member_offboarding();

NOTIFY pgrst, 'reload schema';
