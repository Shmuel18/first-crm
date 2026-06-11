-- =============================================================================
-- Migration 164: rate-limit hardening — refund RPC + service-role lockdown
-- =============================================================================
-- (1) refund_rate_limit: atomic undo for one consume_rate_limit increment.
--     The login gate consumes failure budgets ATOMICALLY before the password
--     check (parallel attempts cannot race past the limit — the DB increment
--     IS the gate) and refunds them when the attempt turns out not to be a
--     failed guess (successful login / infra error), so legitimate logins
--     never accumulate lockout budget.
--     Degradation while this migration is missing: the refund no-ops →
--     successful logins keep consuming budget (the old self-lockout) —
--     strictly MORE blocking, never a silently disabled defense.
--
-- (2) Lock ALL rate-limit RPCs to service_role. consume_rate_limit (048) was
--     executable with the PUBLIC anon key (default EXECUTE was never
--     revoked): anyone could call it directly via PostgREST and burn a
--     victim's login / password-reset budgets — a targeted lockout DoS with
--     zero password attempts. An anon-callable refund would be the mirror
--     hole (attackers resetting their own lockout counters). Both now
--     require the service-role key; the TS wrappers in src/lib/rate-limit.ts
--     use the admin client and only ever run server-side.
--
-- !! DEPLOY ORDER — OPPOSITE OF THE USUAL MIGRATIONS-FIRST RULE: apply this
--    AFTER deploying the code that switches src/lib/rate-limit.ts to the
--    service-role client. Applying it under the OLD code makes its
--    anon-context consume calls fail -> the fail-closed gates (login,
--    password reset) refuse everyone until the new code is live.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refund_rate_limit(
  p_action TEXT,
  p_subject TEXT,
  p_window_seconds INT
)
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.rate_limit_counters
     SET count = GREATEST(count - 1, 0)
   WHERE action_key = p_action
     AND subject_key = p_subject
     AND window_start = date_bin(make_interval(secs => p_window_seconds), now(), 'epoch');
$$;

REVOKE ALL ON FUNCTION public.refund_rate_limit(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_rate_limit(TEXT, TEXT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INT, INT) TO service_role;

INSERT INTO public.schema_version (version) VALUES (164) ON CONFLICT DO NOTHING;
