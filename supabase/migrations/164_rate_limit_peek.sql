-- =============================================================================
-- Migration 164: peek_rate_limit — read-only rate-limit check
-- =============================================================================
-- Companion to consume_rate_limit (migration 048). Reports whether the
-- subject still has budget in the CURRENT window WITHOUT incrementing the
-- counter.
--
-- Why: gates where only FAILURES should count (login lockout, R1-auth-4).
-- The caller peeks before the attempt (block when budget is exhausted) and
-- consumes only after a confirmed failure — so successful logins never burn
-- lockout budget and a user can't lock themselves out by logging in often.
--
-- Same bucket math as consume_rate_limit (date_bin over epoch), so the two
-- functions always see the same window for a given (action, subject).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.peek_rate_limit(
  p_action TEXT,
  p_subject TEXT,
  p_max INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT count
      FROM public.rate_limit_counters
     WHERE action_key = p_action
       AND subject_key = p_subject
       AND window_start = date_bin(make_interval(secs => p_window_seconds), now(), 'epoch')
  ), 0) < p_max;
$$;

-- Callable by unauthenticated flows (login runs as anon) — same posture as
-- consume_rate_limit, made explicit here.
REVOKE ALL ON FUNCTION public.peek_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_rate_limit(TEXT, TEXT, INT, INT) TO anon, authenticated;

INSERT INTO public.schema_version (version) VALUES (164) ON CONFLICT DO NOTHING;
