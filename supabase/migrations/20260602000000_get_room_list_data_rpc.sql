-- Combines the N+1 unread-count queries and N+1 last-message queries
-- in fetchRooms() into a single RPC call.
CREATE OR REPLACE FUNCTION get_room_list_data(
  p_room_ids  uuid[],
  p_user_id   uuid
)
RETURNS TABLE (
  room_id               uuid,
  unread_count          bigint,
  last_message_content  text,
  last_message_at       timestamptz,
  last_message_type     text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH my_rooms AS (
    SELECT room_id, last_read_at
    FROM   room_members
    WHERE  user_id    = p_user_id
      AND  room_id    = ANY(p_room_ids)
  ),
  unread AS (
    SELECT
      mr.room_id,
      COUNT(m.id) AS cnt
    FROM   my_rooms mr
    LEFT JOIN messages m
      ON  m.room_id        = mr.room_id
      AND m.deleted_at     IS NULL
      AND m.thread_root_id IS NULL
      AND m.sender_id      != p_user_id
      AND m.created_at     > COALESCE(mr.last_read_at, '-infinity'::timestamptz)
    GROUP BY mr.room_id
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.room_id)
      m.room_id,
      m.content,
      m.created_at,
      m.message_type
    FROM messages m
    WHERE m.room_id        = ANY(p_room_ids)
      AND m.deleted_at     IS NULL
      AND m.thread_root_id IS NULL
      AND m.message_type   != 'system'
    ORDER BY m.room_id, m.created_at DESC
  )
  SELECT
    r.id                        AS room_id,
    COALESCE(u.cnt, 0)          AS unread_count,
    lm.content                  AS last_message_content,
    lm.created_at               AS last_message_at,
    lm.message_type             AS last_message_type
  FROM   unnest(p_room_ids) AS r(id)
  LEFT JOIN unread   u  ON u.room_id  = r.id
  LEFT JOIN last_msg lm ON lm.room_id = r.id
$$;
