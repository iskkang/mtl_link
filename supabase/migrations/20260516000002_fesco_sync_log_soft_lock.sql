-- Add started_at column so the sync soft-lock can detect in-progress runs.
-- finished_at must be nullable: an in-progress run inserts with finished_at = NULL
-- and updates it only when the sync completes (success or error).

ALTER TABLE public.fesco_sync_log
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.fesco_sync_log
  ALTER COLUMN finished_at DROP NOT NULL;

-- Partial index for the soft-lock query: rows still running (finished_at IS NULL).
CREATE INDEX IF NOT EXISTS idx_fesco_sync_log_running
  ON public.fesco_sync_log (started_at)
  WHERE finished_at IS NULL;
