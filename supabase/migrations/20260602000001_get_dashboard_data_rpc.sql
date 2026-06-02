-- Replaces 8 separate polling requests (fetchRooms steps 1-5 + loadCounts ×2
-- + get_or_create_mint_dm_room) with a single RPC call.
CREATE OR REPLACE FUNCTION get_dashboard_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_room_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(room_id) INTO v_room_ids
  FROM room_members WHERE user_id = p_user_id;

  IF v_room_ids IS NULL THEN
    RETURN jsonb_build_object(
      'myMems',        '[]'::jsonb,
      'rooms',         '[]'::jsonb,
      'allMems',       '[]'::jsonb,
      'profiles',      '[]'::jsonb,
      'roomListData',  '[]'::jsonb,
      'requestCounts', '{"received":0,"sent":0}'::jsonb
    );
  END IF;

  RETURN (
    WITH my_mems AS (
      SELECT room_id, is_pinned, is_muted, last_read_at
      FROM room_members WHERE user_id = p_user_id
    ),
    rooms_data AS (
      SELECT * FROM rooms
      WHERE id = ANY(v_room_ids)
      ORDER BY last_message_at DESC NULLS LAST
    ),
    all_mems AS (
      SELECT room_id, user_id, last_read_at
      FROM room_members WHERE room_id = ANY(v_room_ids)
    ),
    member_profiles AS (
      SELECT id, name, avatar_url, avatar_color, preferred_language,
             is_bot, presence_status, status_message
      FROM profiles WHERE id IN (SELECT DISTINCT user_id FROM all_mems)
    ),
    unread AS (
      SELECT mr.room_id, COUNT(m.id) AS cnt
      FROM my_mems mr
      LEFT JOIN messages m ON
        m.room_id        = mr.room_id
        AND m.deleted_at     IS NULL
        AND m.thread_root_id IS NULL
        AND m.sender_id      != p_user_id
        AND m.created_at     > COALESCE(mr.last_read_at, '-infinity'::timestamptz)
      GROUP BY mr.room_id
    ),
    last_msg AS (
      SELECT DISTINCT ON (m.room_id)
        m.room_id, m.content, m.created_at, m.message_type
      FROM messages m
      WHERE m.room_id        = ANY(v_room_ids)
        AND m.deleted_at     IS NULL
        AND m.thread_root_id IS NULL
        AND m.message_type   != 'system'
      ORDER BY m.room_id, m.created_at DESC
    ),
    room_list AS (
      SELECT
        r.id                      AS room_id,
        COALESCE(u.cnt, 0)        AS unread_count,
        lm.content                AS last_message_content,
        lm.created_at             AS last_message_at,
        lm.message_type           AS last_message_type
      FROM unnest(v_room_ids) AS r(id)
      LEFT JOIN unread   u  ON u.room_id  = r.id
      LEFT JOIN last_msg lm ON lm.room_id = r.id
    ),
    req_counts AS (
      SELECT
        COUNT(*) FILTER (
          WHERE sender_id       != p_user_id
            AND needs_response   = true
            AND response_received = false
            AND deleted_at       IS NULL
        ) AS received,
        COUNT(*) FILTER (
          WHERE sender_id       = p_user_id
            AND needs_response   = true
            AND response_received = false
            AND deleted_at       IS NULL
        ) AS sent
      FROM messages WHERE room_id = ANY(v_room_ids)
    )
    SELECT jsonb_build_object(
      'myMems',        COALESCE((SELECT jsonb_agg(to_jsonb(mm)) FROM my_mems mm),          '[]'),
      'rooms',         COALESCE((SELECT jsonb_agg(to_jsonb(rd)) FROM rooms_data rd),        '[]'),
      'allMems',       COALESCE((SELECT jsonb_agg(to_jsonb(am)) FROM all_mems am),          '[]'),
      'profiles',      COALESCE((SELECT jsonb_agg(to_jsonb(p))  FROM member_profiles p),    '[]'),
      'roomListData',  COALESCE((SELECT jsonb_agg(to_jsonb(rl)) FROM room_list rl),         '[]'),
      'requestCounts', (SELECT jsonb_build_object('received', received, 'sent', sent) FROM req_counts)
    )
  );
END;
$$;
