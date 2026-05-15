-- Replaces the application-level check-then-insert soft lock with a
-- database-enforced unique partial index + atomic RPC function.
--
-- How the lock works:
--   A row with finished_at IS NULL represents an active sync.
--   The unique partial index below allows at most ONE such row.
--   Any concurrent INSERT of a second active row raises unique_violation (23505),
--   which the RPC catches and converts to a clean (ok=false) return value.
--   Stale locks (started > 15 minutes ago, never finished) are evicted first
--   so a crashed sync can never permanently block future runs.

-- Unique partial index: enforces "at most one active sync at a time".
-- Indexes the constant expression (1) for all rows where finished_at IS NULL,
-- so any two active rows would have the same index entry — rejected by Postgres.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fesco_sync_one_active
  ON public.fesco_sync_log ((1))
  WHERE finished_at IS NULL;

-- Atomic lock acquisition + start-row insertion.
-- Returns (ok=true, lock_id=<new row id>) on success.
-- Returns (ok=false, lock_id=NULL) if another active sync exists.
CREATE OR REPLACE FUNCTION public.fesco_sync_try_lock()
RETURNS TABLE(ok boolean, lock_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id bigint;
BEGIN
  -- Evict locks that started more than 15 minutes ago without completing.
  -- This ensures a crashed or timed-out sync does not block future runs.
  DELETE FROM fesco_sync_log
  WHERE finished_at IS NULL
    AND started_at < now() - interval '15 minutes';

  -- Attempt to claim the active slot.
  -- The unique partial index on (1) WHERE finished_at IS NULL guarantees
  -- this INSERT fails with unique_violation if any active row already exists.
  BEGIN
    INSERT INTO fesco_sync_log (started_at)
    VALUES (now())
    RETURNING id INTO _id;

    RETURN QUERY SELECT true, _id;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, NULL::bigint;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fesco_sync_try_lock() TO service_role;
