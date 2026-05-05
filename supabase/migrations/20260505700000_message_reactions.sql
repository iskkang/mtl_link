CREATE TABLE public.message_reactions (
  message_id uuid        NOT NULL REFERENCES public.messages(id)  ON DELETE CASCADE,
  room_id    uuid        NOT NULL REFERENCES public.rooms(id)      ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  emoji      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message ON public.message_reactions(message_id);
CREATE INDEX idx_message_reactions_room    ON public.message_reactions(room_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select_member" ON public.message_reactions
  FOR SELECT USING (public.is_room_member(room_id, auth.uid()));

CREATE POLICY "reactions_insert_self_member" ON public.message_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));

CREATE POLICY "reactions_delete_self" ON public.message_reactions
  FOR DELETE USING (user_id = auth.uid());
