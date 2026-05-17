-- v1.10.0: Store full FESCO segments array as JSONB on the container tracking row.
-- Enables future smart-alert derivation (v1.10.1) without losing backward compatibility.

alter table public.fesco_container_tracking_current
  add column if not exists segments_json jsonb;

create index if not exists fesco_ctc_segments_json_gin_idx
  on public.fesco_container_tracking_current
  using gin (segments_json jsonb_path_ops);

comment on column public.fesco_container_tracking_current.segments_json is
  'Full segments array from FESCO API. Each element has segmentType, completed, inProgress, plan, departureLocation, destinationLocation, planning/actual dates, transport. Source of truth for multi-leg journey data.';
