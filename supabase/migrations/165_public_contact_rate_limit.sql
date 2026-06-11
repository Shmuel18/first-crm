-- =============================================================================
-- Migration 165: per-IP rate limit for the public landing contact form
-- =============================================================================
-- The marketing site (separate Vercel project) exposes /api/contact, which on
-- every submission (a) emails the office, (b) emails a BRANDED confirmation to
-- the address the caller typed, and (c) creates a lead via submit_public_intake.
-- Leg (b) makes the endpoint an email relay: a script can make our verified
-- domain send mail to arbitrary recipients, torching deliverability and bombing
-- inboxes — while also flooding the leads table. The page's honeypot + timing +
-- localStorage throttle are CLIENT-side only and a `curl` ignores them entirely.
--
-- The CRM's own /check action gates the same RPC with checkRateLimit(), but that
-- path uses the SERVICE-ROLE client and consume_rate_limit is service_role-only
-- since migration 164. The landing function holds only the public anon key, so
-- it needs its OWN narrow door — exactly the posture of submit_public_intake
-- (151/154): an anon-callable SECURITY DEFINER RPC that is the only way in.
--
-- This function is deliberately least-privilege:
--   * action namespace is HARD-CODED to 'public_contact' — an anon caller can
--     never touch the login / password-reset budgets migration 164 locked down.
--   * max (5) and window (1h) are HARD-CODED — the caller cannot widen them.
--   * it returns only a boolean — it reads/leaks nothing.
-- Residual: an anon caller can name any p_subject, so a hostile party could burn
-- a victim IP's contact-form budget for one hour (targeted DoS). Impact is
-- trivial — the page offers phone / WhatsApp / office email right beside the form
-- — so unlike the login lockout 164 closed, this is an accepted tradeoff.
--
-- Idempotent (CREATE OR REPLACE). Dependencies: 048 (rate_limit_counters),
-- 143 (schema_version).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.consume_public_contact_rate_limit(p_subject text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket timestamptz;
  v_count  int;
BEGIN
  IF p_subject IS NULL OR length(btrim(p_subject)) = 0 OR length(p_subject) > 100 THEN
    RAISE EXCEPTION 'consume_public_contact_rate_limit: invalid subject'
      USING ERRCODE = '22023';
  END IF;

  -- Same bucketing as consume_rate_limit (048): all calls in the wall-clock hour
  -- share one row; a fresh bucket starts at the next hour boundary.
  v_bucket := date_bin(make_interval(secs => 3600), now(), 'epoch');

  INSERT INTO public.rate_limit_counters (action_key, subject_key, window_start, count)
  VALUES ('public_contact', p_subject, v_bucket, 1)
  ON CONFLICT (action_key, subject_key, window_start) DO UPDATE
    SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= 5;
END;
$$;

-- anon = the role a logged-out visitor's request runs as via the public key.
REVOKE ALL ON FUNCTION public.consume_public_contact_rate_limit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_public_contact_rate_limit(text) TO anon, authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (165) ON CONFLICT DO NOTHING;
