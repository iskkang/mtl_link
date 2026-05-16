-- Geocoding cache for city/location strings used in container tracking.
-- Forward-geocodes via Mapbox. lat/lng null = tried but no result (backoff via last_attempt_at).

create table if not exists public.city_coordinates (
  id                 bigserial     primary key,
  query_text         text          not null,
  query_normalized   text          not null,
  latitude           double precision,
  longitude          double precision,
  country_code       text,           -- ISO 3166-1 alpha-2 (e.g. 'RU', 'UZ', 'BY', 'KZ')
  country_name       text,
  mapbox_place_name  text,
  mapbox_place_type  text,
  source             text          not null default 'mapbox',
  geocoded_at        timestamptz,
  last_attempt_at    timestamptz   not null default now(),
  attempt_count      integer       not null default 0,
  error_message      text,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now(),
  unique (query_normalized)
);

create index if not exists city_coordinates_query_normalized_idx
  on public.city_coordinates (query_normalized);

create index if not exists city_coordinates_country_code_idx
  on public.city_coordinates (country_code)
  where country_code is not null;

create index if not exists city_coordinates_geocoded_at_idx
  on public.city_coordinates (geocoded_at)
  where geocoded_at is not null;

comment on table public.city_coordinates is
  'Forward-geocoded city/location strings. lat/lng null = geocoding tried but no result; backoff using last_attempt_at.';

comment on column public.city_coordinates.country_code is
  'ISO alpha-2. Used for destination-country filter in tracking dashboard.';

-- RLS: read-only for authenticated users; service role retains full access.
alter table public.city_coordinates enable row level security;

create policy "city_coordinates_select_authenticated"
  on public.city_coordinates
  for select
  to authenticated
  using (true);
