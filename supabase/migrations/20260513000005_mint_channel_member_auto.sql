-- Add MINT bot to all existing channels
INSERT INTO room_members (room_id, user_id)
SELECT r.id, '00000000-0000-0000-0000-000000000001'
FROM rooms r
WHERE r.room_type = 'channel'
  AND NOT EXISTS (
    SELECT 1 FROM room_members rm
    WHERE rm.room_id = r.id
      AND rm.user_id = '00000000-0000-0000-0000-000000000001'
  );

-- Auto-add MINT bot whenever a new channel is created
CREATE OR REPLACE FUNCTION fn_add_mint_to_new_channel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.room_type = 'channel' THEN
    INSERT INTO room_members (room_id, user_id)
    VALUES (NEW.id, '00000000-0000-0000-0000-000000000001')
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_add_mint_to_new_channel ON rooms;
CREATE TRIGGER trg_add_mint_to_new_channel
  AFTER INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION fn_add_mint_to_new_channel();
