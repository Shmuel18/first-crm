-- =============================================================================
-- Migration 167: remove obsolete anon-callable landing rate-limit RPC
-- =============================================================================
-- Migration 165 created this narrow public RPC for the landing's old standalone
-- /api/contact function. Migration 166 removed that function and routed both
-- public intake paths through the CRM's service-role-only createIntakeLead
-- service, which uses consume_rate_limit instead.
--
-- Leaving the old function callable by anon serves no application purpose and
-- lets an unauthenticated caller create unbounded rate_limit_counters rows by
-- supplying a fresh subject each time. Drop the door and its now-dead buckets.
-- =============================================================================

DROP FUNCTION IF EXISTS public.consume_public_contact_rate_limit(text);

DELETE FROM public.rate_limit_counters
 WHERE action_key = 'public_contact';

INSERT INTO public.schema_version (version) VALUES (167) ON CONFLICT DO NOTHING;
