-- =============================================================================
-- Migration 050: Harden set_request_audit_context (volatility + sanitization)
-- =============================================================================
-- Migration 047 introduced the PostgREST pre-request hook that copies the
-- client IP + UA from request.headers into session GUCs the audit trigger
-- reads. Two issues the audit found:
--
-- 1. Declared STABLE but performs side effects (set_config). Stable functions
--    are allowed to be called fewer times than they appear in a query, which
--    can break the audit context for batched mutations. Should be VOLATILE.
--
-- 2. Trusts X-Forwarded-For verbatim. An attacker bypassing the trusted
--    edge can supply any value, including control characters that break log
--    parsing or huge strings that fill the row. The trigger then writes that
--    straight into audit_log.ip_address / user_agent.
--    Fix: strip control chars, cap to safe lengths.
--
-- Forensic note: even with this fix, the IP is best-effort. The leftmost
-- X-Forwarded-For hop is only authoritative when the request demonstrably
-- went through your trusted edge (Vercel). For requests that bypass the
-- edge, the value is attacker-influenced. Treat audit IPs as observational
-- evidence, not authoritative proof.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_request_audit_context()
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  headers JSONB;
  forwarded TEXT;
  ip TEXT;
  ua TEXT;
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    headers := NULL;
  END;

  IF headers IS NULL THEN
    RETURN;
  END IF;

  forwarded := COALESCE(headers->>'x-forwarded-for', headers->>'x-real-ip');
  IF forwarded IS NOT NULL THEN
    ip := btrim(split_part(forwarded, ',', 1));
    -- Strip CR/LF/null/all other control bytes (log-injection defense)
    -- and cap to a sane length. IPv6 maxes around 45 chars; 64 is comfortable.
    ip := regexp_replace(ip, '[[:cntrl:]]', '', 'g');
    IF length(ip) > 64 THEN
      ip := substring(ip from 1 for 64);
    END IF;
  END IF;

  ua := headers->>'user-agent';
  IF ua IS NOT NULL THEN
    ua := regexp_replace(ua, '[[:cntrl:]]', '', 'g');
    -- Real UA strings rarely exceed 256 bytes; 512 covers pathological
    -- cases without letting a giant string fill the row.
    IF length(ua) > 512 THEN
      ua := substring(ua from 1 for 512);
    END IF;
  END IF;

  PERFORM set_config('app.ip_address', COALESCE(ip, ''), true);
  PERFORM set_config('app.user_agent', COALESCE(ua, ''), true);
END;
$$;

NOTIFY pgrst, 'reload config';
