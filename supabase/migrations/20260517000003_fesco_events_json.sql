-- v1.10.2: Store full FESCO events array as JSONB on the container tracking row.
-- Enables event-based positioning (use events.data[0].locationLatin as primary marker source).

alter table public.fesco_container_tracking_current
  add column if not exists events_json jsonb;

create index if not exists fesco_ctc_events_json_gin_idx
  on public.fesco_container_tracking_current
  using gin (events_json jsonb_path_ops);

comment on column public.fesco_container_tracking_current.events_json is
  'Full events array from FESCO API (events.data). Each element has locationLatin, date, operationLatin, remainingDistance (string), totalDistance (number), transportLatin, type. Sorted date desc. Source of truth for last-known position.';

-- Refresh PostgREST schema cache so the new column is immediately queryable.
notify pgrst, 'reload schema';
