-- FESCO container tracking normalized tables
-- Created as a baseline migration after the tables were initially created manually in Supabase.
-- Safe for existing DB because all CREATE statements use IF NOT EXISTS.

create table if not exists public.fesco_container_tracking_current (
  id bigserial primary key,

  order_id bigint references public.fesco_orders(id) on delete cascade,
  external_1c_number text,
  container_number text not null,

  unavailable boolean default false,
  owner_ship text,
  bills jsonb default '[]'::jsonb,

  current_segment_type text,
  current_from text,
  current_to text,
  current_from_country text,
  current_to_country text,

  departure_date date,
  planned_departure_date date,
  destination_date date,
  planned_destination_date date,

  transport_name text,
  voyage_number text,

  status text,
  alert_level text default 'gray',
  alert_reason text,

  raw_response jsonb,

  last_checked_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (container_number)
);

create index if not exists idx_fesco_ct_current_order_id
  on public.fesco_container_tracking_current(order_id);

create index if not exists idx_fesco_ct_current_external_1c_number
  on public.fesco_container_tracking_current(external_1c_number);

create index if not exists idx_fesco_ct_current_container_number
  on public.fesco_container_tracking_current(container_number);

create index if not exists idx_fesco_ct_current_status
  on public.fesco_container_tracking_current(status);

create index if not exists idx_fesco_ct_current_alert_level
  on public.fesco_container_tracking_current(alert_level);

create index if not exists idx_fesco_ct_current_last_checked_at
  on public.fesco_container_tracking_current(last_checked_at);


create table if not exists public.fesco_container_tracking_segments (
  id bigserial primary key,

  order_id bigint references public.fesco_orders(id) on delete cascade,
  external_1c_number text,
  container_number text not null,

  segment_id text,
  segment_index int,

  segment_type text,

  departure_location text,
  destination_location text,
  departure_country text,
  destination_country text,

  departure_date date,
  destination_date date,
  planned_departure_date date,
  planned_destination_date date,

  current_segment boolean default false,
  in_progress boolean default false,
  completed boolean default false,
  plan boolean default false,

  transport_name text,
  voyage_number text,

  raw_segment jsonb,

  last_checked_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (container_number, segment_index)
);

create index if not exists idx_fesco_ct_segments_order_id
  on public.fesco_container_tracking_segments(order_id);

create index if not exists idx_fesco_ct_segments_external_1c_number
  on public.fesco_container_tracking_segments(external_1c_number);

create index if not exists idx_fesco_ct_segments_container_number
  on public.fesco_container_tracking_segments(container_number);

create index if not exists idx_fesco_ct_segments_current_segment
  on public.fesco_container_tracking_segments(current_segment);

create index if not exists idx_fesco_ct_segments_last_checked_at
  on public.fesco_container_tracking_segments(last_checked_at);


create table if not exists public.fesco_alerts (
  id bigserial primary key,

  order_id bigint references public.fesco_orders(id) on delete cascade,
  external_1c_number text,
  container_number text,

  alert_type text not null,
  severity text not null,

  message text not null,

  status text default 'open',

  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  resolved_at timestamptz,

  raw_context jsonb
);

create index if not exists idx_fesco_alerts_order_id
  on public.fesco_alerts(order_id);

create index if not exists idx_fesco_alerts_external_1c_number
  on public.fesco_alerts(external_1c_number);

create index if not exists idx_fesco_alerts_container_number
  on public.fesco_alerts(container_number);

create index if not exists idx_fesco_alerts_status
  on public.fesco_alerts(status);

create index if not exists idx_fesco_alerts_severity
  on public.fesco_alerts(severity);

create index if not exists idx_fesco_alerts_alert_type
  on public.fesco_alerts(alert_type);

create index if not exists idx_fesco_alerts_last_seen_at
  on public.fesco_alerts(last_seen_at);
