-- =============================================================================
-- Migration 150: Web Push subscriptions (browser push notifications)
-- =============================================================================
-- One row per (user, device/browser) push subscription. Written by the
-- subscribe/unsubscribe server actions and read by /api/push/dispatch (the
-- Supabase Database Webhook target that fires on a new `notifications` row and
-- sends a generic, no-PII push to the user's devices).
--
-- Locked down: RLS is ENABLED with NO policy, so the anon/authenticated roles
-- get nothing. Only the service-role admin client (server-side, after an auth
-- check in the action / a shared-secret check in the dispatch route) touches
-- this table. The FK cascades on profile delete so a removed member's
-- subscriptions are cleaned up automatically.
--
-- Idempotent. Dependencies: 002 (profiles), 143 (schema_version).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The push service endpoint is globally unique per subscription; UNIQUE lets
  -- the subscribe action upsert (re-subscribe / device re-used) cleanly.
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push subscriptions, one per user device/browser. Service-role only (RLS on, no policy). Written by subscribe/unsubscribe actions; read by /api/push/dispatch to fan a generic push out to a user''s devices.';

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.schema_version (version) VALUES (150) ON CONFLICT DO NOTHING;
