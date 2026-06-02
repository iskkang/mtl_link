-- Replaces 3 separate action_items queries (received/created/done) with 1 RPC call.
CREATE OR REPLACE FUNCTION get_action_items_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN (
    WITH ai_joined AS (
      SELECT
        ai.id, ai.message_id, ai.room_id, ai.created_by, ai.assigned_to,
        ai.title, ai.due_date, ai.status, ai.snoozed_until, ai.created_at, ai.updated_at,
        jsonb_build_object(
          'id', cp.id, 'name', cp.name,
          'avatar_url', cp.avatar_url, 'avatar_color', cp.avatar_color,
          'presence_status', cp.presence_status, 'status_message', cp.status_message
        ) AS creator,
        jsonb_build_object(
          'id', ap.id, 'name', ap.name,
          'avatar_url', ap.avatar_url, 'avatar_color', ap.avatar_color,
          'presence_status', ap.presence_status, 'status_message', ap.status_message
        ) AS assignee
      FROM action_items ai
      LEFT JOIN profiles cp ON cp.id = ai.created_by
      LEFT JOIN profiles ap ON ap.id = ai.assigned_to
      WHERE ai.assigned_to = p_user_id OR ai.created_by = p_user_id
    )
    SELECT jsonb_build_object(
      'received', COALESCE(
        (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.due_date ASC NULLS LAST)
         FROM ai_joined r WHERE r.assigned_to = p_user_id AND r.status NOT IN ('done','cancelled')),
        '[]'
      ),
      'created', COALESCE(
        (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.due_date ASC NULLS LAST)
         FROM ai_joined c WHERE c.created_by = p_user_id AND c.status NOT IN ('done','cancelled')),
        '[]'
      ),
      'done', COALESCE(
        (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.updated_at DESC)
         FROM (SELECT * FROM ai_joined WHERE status = 'done' ORDER BY updated_at DESC LIMIT 100) d),
        '[]'
      )
    )
  );
END;
$$;
