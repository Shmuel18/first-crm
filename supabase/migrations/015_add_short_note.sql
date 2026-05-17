-- =============================================================================
-- Migration 015: Add short_note field to cases
-- =============================================================================
-- Purpose: Per spec module 2 block 6 - "הערה קצרה" is a separate field
--          displayed in the dashboard, distinct from "פרטי הבקשה" (request_details).
--          Short note is for quick reminders like "client returns Monday"
--          while request_details is the full case story.
-- =============================================================================

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS short_note TEXT;

COMMENT ON COLUMN public.cases.short_note IS 'Quick note displayed in dashboard (separate from request_details which is the full story)';
