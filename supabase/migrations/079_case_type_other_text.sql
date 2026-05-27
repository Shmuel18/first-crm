-- =============================================================================
-- Migration 079: 'other' case type + free-text column for it
-- =============================================================================
-- The property block on /cases/[id] now offers an "other" option in the
-- transaction-purpose dropdown. When the user picks it, they fill in a
-- short free-text description (e.g. "purchase abroad", "helping family").
--
-- Two parts:
--   1. Seed an 'other' row in case_types (sort_order=99 so it lands last).
--   2. Add cases.case_type_other_text TEXT — only filled when the user
--      picks the 'other' case_type. UI shows/hides the input based on
--      the selected case_type's key.
-- =============================================================================

INSERT INTO public.case_types (key, name_he, name_en, sort_order, is_system) VALUES
  ('other', 'אחר', 'Other', 99, TRUE)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS case_type_other_text TEXT;

COMMENT ON COLUMN public.cases.case_type_other_text IS
  'Free-text description used only when case_type_primary references the "other" row. UI gates the visibility.';
