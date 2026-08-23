-- =============================================================================
-- Migration 235: AI assistant + NL-query permission keys (ai-v2-spec.md §8.2)
-- =============================================================================
-- Two configurable permission keys for the Epic-3/4 surfaces:
--   use_ai_assistant — case briefing + AI message drafting (Epic 3)
--   use_ai_queries   — free-language dashboard queries (Epic 4)
-- (The spec's dotted names ai.assistant / ai.queries map to snake_case per
-- the DB convention, like view_ai_inbox in mig 234.)
--
-- App-level enforcement only (has_permission RPC in the API routes) — no new
-- tables/RLS here. Admin gets both automatically
-- (trg_grant_new_permission_to_admin, mig 169); granting them to the advisor /
-- secretary roles is a deliberate step in the roles editor at connect day.
-- =============================================================================

INSERT INTO public.permissions (key, name_he, name_en, category) VALUES
  ('use_ai_assistant', 'להשתמש בעוזר AI (תדריך וניסוח)', 'Use AI Assistant (briefing & drafting)', 'cases'),
  ('use_ai_queries', 'לשאול שאילתות חופשיות', 'Use AI Free-language Queries', 'system')
ON CONFLICT (key) DO UPDATE
  SET name_he = EXCLUDED.name_he,
      name_en = EXCLUDED.name_en,
      category = EXCLUDED.category;

INSERT INTO public.schema_version (version) VALUES (235) ON CONFLICT DO NOTHING;
