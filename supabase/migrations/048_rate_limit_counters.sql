-- =============================================================================
-- Migration 048: Rate-limit counter infrastructure
-- =============================================================================
-- Generic per-(action, subject, time-bucket) atomic counter. Used by Server
-- Actions that are expensive (PDF/XLSX export, Drive sync, backup) or that
-- function as enumeration oracles (lookup-returning-borrower).
--
-- Why Postgres (not Redis/Upstash):
--   - Zero new infra. The DB is already on the critical path.
--   - Atomicity for free via ON CONFLICT DO UPDATE.
--   - Acceptable latency: a single round-trip we'd be doing anyway in the
--     same action. The volume here is dominated by user clicks, not bots.
--
-- The table itself is locked down (RLS enabled, no policies) — only the
-- SECURITY DEFINER RPC below can touch it. Authenticated clients call the RPC.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  action_key TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (action_key, subject_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_window
  ON public.rate_limit_counters(window_start);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- No policies — direct table access is denied. The RPC is the only door.

-- -----------------------------------------------------------------------------
-- consume_rate_limit: atomically increment the bucket for the current window
-- and return whether the resulting count is still within p_max.
-- -----------------------------------------------------------------------------
-- Returns TRUE while under the limit, FALSE once the count for this bucket
-- exceeds p_max. Callers should refuse the request on FALSE.
--
-- The window is computed via date_bin so all calls in the same wall-clock
-- bucket share a row (predictable burst behavior). A fresh bucket starts
-- at the next window boundary, not p_window_seconds after the last call.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_action TEXT,
  p_subject TEXT,
  p_max INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF p_max IS NULL OR p_max <= 0 OR p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'consume_rate_limit: max and window_seconds must be positive';
  END IF;

  v_bucket := date_bin(
    make_interval(secs => p_window_seconds),
    now(),
    'epoch'
  );

  INSERT INTO public.rate_limit_counters (action_key, subject_key, window_start, count)
  VALUES (p_action, p_subject, v_bucket, 1)
  ON CONFLICT (action_key, subject_key, window_start) DO UPDATE
    SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INT, INT) TO authenticated;

-- -----------------------------------------------------------------------------
-- cleanup_rate_limit_counters: drop buckets older than 1 day.
-- -----------------------------------------------------------------------------
-- The longest window we plan to use is a few hours; anything older is dead
-- weight on the index. Call from a cron or attach to the nightly retention
-- purge later.
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_counters()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM public.rate_limit_counters
   WHERE window_start < now() - INTERVAL '1 day';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
