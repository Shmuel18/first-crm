-- =============================================================================
-- Migration 166: lock submit_public_intake to service_role
-- =============================================================================
-- Migration 154 granted EXECUTE on submit_public_intake to anon + authenticated
-- so the public /check questionnaire (a logged-out prospect runs as anon) could
-- create a lead. The side effect: ANYONE holding the public anon key (it ships
-- in the page) can call the RPC DIRECTLY via PostgREST — bypassing every
-- application-layer defense (rate-limit, honeypot, timing trap) to flood the
-- leads table and spam every admin with 'web_lead' bell notifications. The
-- landing /api/contact rate-limit (mig 165) does nothing against this: the
-- attacker simply skips /api/contact and hits the RPC.
--
-- Fix: revoke the anon/authenticated grants; only service_role may call it now.
-- Both write paths run server-side through the service-role admin client:
--   - /check               -> submitIntakeAction -> createIntakeLead (admin)
--   - landing contact form -> /api/web-lead route -> createIntakeLead (admin)
-- Same lockdown posture as migration 164 (rate-limit RPCs).
--
-- !! DEPLOY ORDER — OPPOSITE OF THE USUAL MIGRATIONS-FIRST RULE: apply this
--    AFTER the code that switches both write paths to the admin client is live.
--    Applying it under the OLD code makes the anon-context /check + landing RPC
--    calls fail -> public intake + contact form 400 for everyone until the new
--    code ships.
--
-- Idempotent. Dependencies: 154 (the 3-arg function), 143 (schema_version).
-- =============================================================================

REVOKE ALL ON FUNCTION public.submit_public_intake(jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_intake(jsonb, text, text) TO service_role;

INSERT INTO public.schema_version (version) VALUES (166) ON CONFLICT DO NOTHING;
