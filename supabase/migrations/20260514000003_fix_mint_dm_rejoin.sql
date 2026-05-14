-- get_or_create_mint_dm_room: 사용자가 방을 나간 경우 자동 재가입
CREATE OR REPLACE FUNCTION get_or_create_mint_dm_room()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_bot_id  UUID := '00000000-0000-0000-0000-000000000001';
  v_room_id UUID;
BEGIN
  -- 1. 이미 멤버인 mint_dm 방 찾기
  SELECT rm.room_id INTO v_room_id
  FROM room_members rm
  JOIN rooms r ON r.id = rm.room_id
  WHERE rm.user_id = v_user_id
    AND r.room_type = 'mint_dm'
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  -- 2. 멤버가 아닌 기존 mint_dm 방 찾기 (나간 경우) → 재가입
  SELECT r.id INTO v_room_id
  FROM rooms r
  JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = v_bot_id
  WHERE r.room_type = 'mint_dm'
    AND NOT EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = r.id AND user_id = v_user_id
    )
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    INSERT INTO room_members (room_id, user_id)
    VALUES (v_room_id, v_user_id)
    ON CONFLICT DO NOTHING;
    RETURN v_room_id;
  END IF;

  -- 3. 방 자체가 없는 경우 새로 생성
  INSERT INTO rooms (room_type)
  VALUES ('mint_dm')
  RETURNING id INTO v_room_id;

  INSERT INTO room_members (room_id, user_id)
  VALUES (v_room_id, v_user_id), (v_room_id, v_bot_id);

  RETURN v_room_id;
END;
$$;
