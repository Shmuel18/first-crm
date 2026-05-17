-- =============================================================================
-- Migration 016: Admin Block Fields (Module 2 Block 6.1)
-- =============================================================================
-- Purpose: Add missing fields per spec for the admin block of a case:
--   - case_blocker (גורם מעכב) - 6 values
--   - insurance_status (ביטוחים) - 3 values
--   - referrer_name (הופנה ע"י) - free text
-- =============================================================================

-- Add new fields
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS case_blocker TEXT
    CHECK (case_blocker IN ('none', 'client', 'bank', 'office', 'appraiser', 'lawyer'));

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS insurance_status TEXT
    CHECK (insurance_status IN ('exists', 'in_progress', 'missing'));

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS referrer_name TEXT;

-- Comments for clarity
COMMENT ON COLUMN public.cases.case_blocker IS 'Who is blocking the case (per spec): none/client/bank/office/appraiser/lawyer';
COMMENT ON COLUMN public.cases.insurance_status IS 'Insurance status (spec module 2 block 6): exists/in_progress/missing';
COMMENT ON COLUMN public.cases.referrer_name IS 'Free text - who referred this client to the office';
