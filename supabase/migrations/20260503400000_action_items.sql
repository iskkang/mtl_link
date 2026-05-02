-- Action Items (할 일) table
CREATE TABLE IF NOT EXISTS action_items (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id    uuid        REFERENCES messages(id) ON DELETE SET NULL,
  room_id       uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_by    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  due_date      timestamptz,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'done', 'cancelled', 'snoozed')),
  snoozed_until timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS action_items_assigned_to_idx ON action_items(assigned_to);
CREATE INDEX IF NOT EXISTS action_items_created_by_idx  ON action_items(created_by);
CREATE INDEX IF NOT EXISTS action_items_due_date_idx    ON action_items(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS action_items_status_idx      ON action_items(status);

-- updated_at trigger
CREATE TRIGGER set_action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable RLS
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "action_items_select" ON action_items
  FOR SELECT USING (
    created_by  = auth.uid() OR
    assigned_to = auth.uid()
  );

CREATE POLICY "action_items_insert" ON action_items
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "action_items_update" ON action_items
  FOR UPDATE USING (
    created_by  = auth.uid() OR
    assigned_to = auth.uid()
  );

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE action_items;
