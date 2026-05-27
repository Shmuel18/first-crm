-- =============================================================================
-- Migration 083: Add the missing 'lead' status row
-- =============================================================================
-- Bug fix: the create_case_draft RPC (migration 074) looks up case_statuses
-- by key='lead' to assign the default status for /cases/new saves, but the
-- seed (migration 004) never inserted that row — the first seeded status is
-- 'case_opened'. Result: every /cases/new save raised
--   'lead status row missing — seed data not loaded'
-- and the action returned 'unknown' to the UI.
--
-- The spec lists "ליד" as the first stage in the funnel (before "פתיחת תיק"),
-- so this also brings the seed in line with the documented status list.
--
-- Inserted at sort_order=0 so it sorts before case_opened (sort_order=1)
-- without renumbering existing rows. Color is sky-600 — distinguishable from
-- submitted_to_bank (#1D4ED8 blue-700) and case_opened (#64748B slate-500),
-- and reads as "fresh / early funnel".
-- Dependencies: 004_lookups_seed.sql, 074_create_case_draft_rpc.sql.
-- =============================================================================

INSERT INTO public.case_statuses (key, name_he, name_en, color, sort_order, is_terminal, is_system) VALUES
  ('lead', 'ליד', 'Lead', '#0284C7', 0, FALSE, TRUE)
ON CONFLICT (key) DO NOTHING;
