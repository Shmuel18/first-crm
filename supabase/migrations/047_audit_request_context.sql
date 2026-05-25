-- =============================================================================
-- Migration 047: Wire audit_log.ip_address + user_agent via PostgREST pre-request
-- =============================================================================
-- The audit_log_change trigger (migration 022) reads two session GUCs:
--   - current_setting('app.ip_address', true)
--   - current_setting('app.user_agent', true)
-- But nothing in the codebase ever SET them, so every audit row had NULL in
-- those columns since day one — useless for any post-incident investigation.
--
-- Fix: use PostgREST's `db-pre-request` mechanism. The function below runs
-- before every API request, copies the client IP + UA from request.headers
-- into the matching app.* GUCs in transaction-local scope, so the trigger
-- inside the same transaction reads real values.
--
-- Why this approach over wrapping createClient() in TS:
--   - Supabase pools connections in transaction mode; SET LOCAL only sticks
--     for the current transaction. A TS wrapper would have to bracket EVERY
--     mutation in an explicit transaction-with-set_config — invasive across
--     ~50 action files and easy to forget on the next one.
--   - This hook fires once per request, regardless of how many statements
--     PostgREST emits, so it covers every existing and future endpoint with
--     zero TS plumbing.
--
-- system_actor is intentionally NOT set here — it's the fallback for
-- SECURITY DEFINER paths with no session. Those paths can keep using
-- `SET LOCAL app.system_actor` explicitly when they need it.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_request_audit_context()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  headers JSONB;
  forwarded TEXT;
  ip TEXT;
BEGIN
  -- PostgREST exposes request headers as a JSON string under this GUC.
  -- `true` flag returns NULL instead of throwing when the GUC is unset
  -- (e.g., during a direct psql session).
  BEGIN
    headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    headers := NULL;
  END;

  IF headers IS NULL THEN
    RETURN;
  END IF;

  -- Vercel & most reverse-proxies use x-forwarded-for, which can be a
  -- comma-separated chain (client, proxy1, proxy2, ...). Take the leftmost
  -- entry as the original client. Fall back to x-real-ip, then nothing.
  forwarded := COALESCE(headers->>'x-forwarded-for', headers->>'x-real-ip');
  IF forwarded IS NOT NULL THEN
    ip := btrim(split_part(forwarded, ',', 1));
  END IF;

  PERFORM set_config('app.ip_address', COALESCE(ip, ''), true);
  PERFORM set_config('app.user_agent', COALESCE(headers->>'user-agent', ''), true);
END;
$$;

-- Configure PostgREST to call this before every request. The `authenticator`
-- role is the one PostgREST connects as; the GUC is per-role and PostgREST
-- picks it up on the next reload.
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.set_request_audit_context';

-- Force a config reload so the change applies without waiting for the next
-- PostgREST restart. Safe to run repeatedly.
NOTIFY pgrst, 'reload config';

GRANT EXECUTE ON FUNCTION public.set_request_audit_context() TO authenticator;
