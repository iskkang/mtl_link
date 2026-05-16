-- v1.8.1: Add stale tracking and retry metadata columns to fesco_container_tracking_current
-- Columns: last_success_at, last_error_at, last_error_message, consecutive_errors
-- Backfills last_success_at from existing timestamp columns so no row starts as stale.

ALTER TABLE public.fesco_container_tracking_current
  ADD COLUMN IF NOT EXISTS last_success_at      timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_at        timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_message   text,
  ADD COLUMN IF NOT EXISTS consecutive_errors   int not null default 0;

UPDATE public.fesco_container_tracking_current
SET last_success_at = COALESCE(last_success_at, last_checked_at, updated_at, created_at)
WHERE last_success_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fesco_ct_current_last_success_at
  ON public.fesco_container_tracking_current(last_success_at);

CREATE INDEX IF NOT EXISTS idx_fesco_ct_current_last_error_at
  ON public.fesco_container_tracking_current(last_error_at);

CREATE INDEX IF NOT EXISTS idx_fesco_ct_current_consecutive_errors
  ON public.fesco_container_tracking_current(consecutive_errors);
