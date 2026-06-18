-- =============================================================================
-- Migration 198: least-privilege EXECUTE on two SECURITY DEFINER RPCs
--                (Theme: rounds 19-20 — MIG073-RPC-PUBLIC-GRANT + DEF-1)
-- =============================================================================
-- A newly-created Postgres function carries an implicit EXECUTE grant to PUBLIC.
-- Two SECURITY DEFINER functions never revoked it, so anon/authenticated retain
-- EXECUTE on privileged operations even though their only legitimate callers run
-- with elevated rights:
--
--   * insert_overdue_notifications(jsonb) (mig 073) — SECURITY DEFINER, bypasses
--     the notifications_no_direct_insert WITH CHECK(false) policy (mig 060).
--     With the default PUBLIC grant, any authenticated user could POST
--     /rest/v1/rpc/insert_overdue_notifications with attacker-chosen rows and
--     spoof any victim's notification bell (FK-bounded + dedup-bounded, so
--     nuisance not data-loss). Only caller is sla-check.service.ts via the
--     service-role admin client — unaffected by the revoke.
--   * cleanup_rate_limit_counters() (mig 048) — SECURITY DEFINER purge of the
--     rate-limit table; had NO grant/revoke at all, so it sat on the implicit
--     PUBLIC grant. Only caller is the pg_cron schedule (mig 057), which runs as
--     the job owner regardless of role grants — unaffected by the revoke.
--
-- Mirrors mig 164's treatment of consume_rate_limit/refund_rate_limit. Pure grant
-- change, no behavior change, no code change, no special deploy ordering. Idempotent.
-- NOTE: has_permission()/is_admin() were considered (AUTH-03) but deliberately
-- left alone — they are evaluated inside RLS policies whose TO-clause coverage of
-- anon needs a full per-policy audit before narrowing, out of scope here. Deps: 048, 073.
-- =============================================================================

REVOKE ALL ON FUNCTION public.insert_overdue_notifications(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_overdue_notifications(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_rate_limit_counters() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_counters() TO service_role;

INSERT INTO public.schema_version (version) VALUES (198) ON CONFLICT DO NOTHING;
