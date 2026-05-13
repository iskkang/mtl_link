-- supabase/migrations/20260513000003_bot_rename_rpc.sql

-- Rename bot and set MINT avatar
UPDATE public.profiles
SET
  name       = 'MINT',
  avatar_url = '/mint-logo-avatar.svg'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- RPC: collect messages the user is permitted to see
CREATE OR REPLACE FUNCTION get_user_related_messages(
  p_user_id UUID,
  p_since   TIMESTAMPTZ,
  p_limit   INT DEFAULT 200
)
RETURNS TABLE (
  id          UUID,
  room_id     UUID,
  room_name   TEXT,
  sender_id   UUID,
  sender_name TEXT,
  content     TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.room_id,
    r.name     AS room_name,
    m.sender_id,
    p.name     AS sender_name,
    m.content,
    m.created_at
  FROM messages m
  JOIN rooms    r ON r.id = m.room_id
  JOIN profiles p ON p.id = m.sender_id
  WHERE m.created_at >= p_since
    AND m.message_type = 'text'
    AND m.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = m.room_id AND rm.user_id = p_user_id
    )
    AND p.is_bot = FALSE
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$;
