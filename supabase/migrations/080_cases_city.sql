-- =============================================================================
-- Migration 080: cases.city column
-- =============================================================================
-- The redesigned property block on /cases/[id] now captures the property's
-- city as a distinct field (was free-text inside request_details before).
-- TEXT with no length cap at the DB level — UI cap is NAME_MAX (120).
-- =============================================================================

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS city TEXT;

COMMENT ON COLUMN public.cases.city IS
  'City where the property under deal is located. Free text; UI enforces a length cap.';
