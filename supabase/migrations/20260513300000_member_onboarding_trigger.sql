-- =========================================================
-- room_members INSERT 시 member-onboarding Edge Function 호출
-- =========================================================

CREATE OR REPLACE FUNCTION fn_trigger_member_onboarding()
RETURNS TRIGGER AS $$
DECLARE
  v_room_type  TEXT;
  v_secret     TEXT;
  v_request_id BIGINT;
BEGIN
  -- 채널 타입만 대상 (DM, mint_dm 제외)
  SELECT room_type INTO v_room_type FROM rooms WHERE id = NEW.room_id;

  IF v_room_type IS DISTINCT FROM 'channel' THEN
    RETURN NEW;
  END IF;

  -- vault에서 Bearer secret 조회
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_briefing_secret'
  LIMIT 1;

  -- pg_net으로 Edge Function 비동기 호출
  SELECT net.http_post(
    url     := 'https://zidkckbabtajpgkhxmfm.supabase.co/functions/v1/member-onboarding',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := jsonb_build_object(
      'room_id', NEW.room_id,
      'user_id', NEW.user_id
    )
  ) INTO v_request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_trigger_member_onboarding IS
  'Triggers MINT onboarding message when a new member joins a channel.';

DROP TRIGGER IF EXISTS trg_member_onboarding ON room_members;
CREATE TRIGGER trg_member_onboarding
  AFTER INSERT ON room_members
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_member_onboarding();
