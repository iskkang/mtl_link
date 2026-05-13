-- supabase/migrations/20260513000004_get_or_create_mint_dm_room.sql

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
  -- Find existing mint_dm room for this user
  SELECT rm.room_id INTO v_room_id
  FROM room_members rm
  JOIN rooms r ON r.id = rm.room_id
  WHERE rm.user_id = v_user_id
    AND r.room_type = 'mint_dm'
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  -- Create new mint_dm room (no name required — mint_dm is exempt from name constraint)
  INSERT INTO rooms (room_type)
  VALUES ('mint_dm')
  RETURNING id INTO v_room_id;

  -- Add user and bot as members
  INSERT INTO room_members (room_id, user_id)
  VALUES (v_room_id, v_user_id), (v_room_id, v_bot_id);

  RETURN v_room_id;
END;
$$;
