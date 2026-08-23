-- =============================================================================
-- Migration 231: AI infrastructure (Epic 0 of ai-v2-spec.md)
-- =============================================================================
-- Foundation for the V2 AI features (doc classification, email triage,
-- assistant, NL queries). This migration ships NO behavior: with the default
-- flags everything is OFF and the system is bit-identical to today. Spec:
-- Kaufman-Finance-Spec/ai-v2-spec.md §1 (Epic 0) + §0.1 (non-regression).
--
-- Two pieces:
--
-- 1. office_settings.ai_features (JSONB) — per-feature flags, shape owned by
--    the TS layer (src/lib/ai/flags.ts, Zod-validated with safe fallbacks):
--      { "enabled": bool, "modes": { "<feature>": "off|shadow|suggest|auto" } }
--    DEFAULT '{}' parses to { enabled: false, modes: all-off } — the kill
--    switch ships CLOSED. JSONB (not columns) because features will be added
--    per epic and the flag shape is validated in one place in TS; a malformed
--    value degrades to all-off, never to enabled.
--
-- 2. ai_usage_log — cost/latency telemetry for every model call. One row per
--    call, NO CONTENT EVER (no prompts, no responses, no document text) — the
--    privacy stance is that model I/O is never persisted outside its target
--    (spec §1.3). Feeds the Settings cost panel and the per-feature accuracy
--    reviews. Deliberately EXCLUDED from backups (telemetry, not durable
--    business data — see backup-restore-allowlist.test.ts).
--
--    Writes: server-side only via the service-role client (RLS has no INSERT
--    policy on purpose — the browser can never write telemetry). Reads:
--    admins only (cost panel is a manager surface).
--
-- Dependencies: 010 (office_settings), 143 (schema_version), is_admin().
-- Indexes are created inline (plain CREATE INDEX): the table is born empty,
-- so the CONCURRENTLY rule for populated tables does not apply.
-- =============================================================================

-- 1. Feature flags -----------------------------------------------------------

ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS ai_features JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.office_settings.ai_features IS
  'AI feature flags: {enabled: bool, modes: {<feature>: off|shadow|suggest|auto}}. Parsed/validated in src/lib/ai/flags.ts; empty object = everything off (kill switch ships closed).';

-- 2. Usage telemetry ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Free-text feature key (matches AiFeature in src/lib/ai/types.ts). No CHECK
  -- enum on purpose: adding a feature must not require a migration; the TS
  -- layer is the single source of truth for valid keys.
  feature TEXT NOT NULL CHECK (char_length(feature) BETWEEN 1 AND 64),
  model TEXT NOT NULL CHECK (char_length(model) BETWEEN 1 AND 64),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  ok BOOLEAN NOT NULL,
  -- AiErrorCode when ok=false ('rate_limited', 'invalid_output', ...). NULL on
  -- success. Never a raw provider message (those stay in server logs only).
  error_code TEXT NULL CHECK (error_code IS NULL OR char_length(error_code) <= 64),
  case_id UUID NULL REFERENCES public.cases(id) ON DELETE SET NULL,
  created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage_log IS
  'One row per AI model call: tokens, latency, outcome. NEVER stores prompt/response content. Written via service role only; read by admins (Settings cost panel).';

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature_created
  ON public.ai_usage_log (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_case
  ON public.ai_usage_log (case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_by
  ON public.ai_usage_log (created_by) WHERE created_by IS NOT NULL;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Admins read (cost panel). NO INSERT/UPDATE/DELETE policies: mutations happen
-- exclusively through the service-role client, which bypasses RLS — a user JWT
-- can never write or tamper with telemetry.
DROP POLICY IF EXISTS ai_usage_log_select_admin ON public.ai_usage_log;
CREATE POLICY ai_usage_log_select_admin ON public.ai_usage_log
  FOR SELECT USING (public.is_admin());

-- 3. Register ----------------------------------------------------------------

INSERT INTO public.schema_version (version) VALUES (231) ON CONFLICT DO NOTHING;
