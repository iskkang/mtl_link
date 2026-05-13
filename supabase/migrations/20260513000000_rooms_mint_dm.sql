-- supabase/migrations/20260513000000_rooms_mint_dm.sql
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_room_type_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_type_check
  CHECK (room_type IN ('direct', 'group', 'channel', 'mint_dm'));

ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS group_room_name_required;
ALTER TABLE public.rooms ADD CONSTRAINT group_room_name_required CHECK (
  (room_type IN ('group', 'channel') AND name IS NOT NULL AND length(trim(name)) > 0)
  OR room_type IN ('direct', 'mint_dm')
);
