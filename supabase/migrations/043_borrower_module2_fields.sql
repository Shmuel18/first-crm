-- =============================================================================
-- Migration 043: Borrower Module 2 fields
-- =============================================================================
-- Purpose: Add the borrower-profile fields the Module 2 spec requires which
--          the original 007 schema did not cover.
--
--   • id_issue_date       — תוקף ת״ז (Israeli ID issue date; used to verify
--                            the ID hasn't expired when submitting to a bank).
--   • preferred_language  — שפת תקשורת ('he' / 'en'). Drives WhatsApp /
--                            email template language and PDF output.
--   • related_to_sellers  — האם הקונה קשור למוכרים. Banks treat related
--                            parties differently (lower LTV cap, extra docs).
--   • landline_phone      — טלפון קווי (the existing `phone` column is the
--                            mobile per the form label "טלפון נייד").
--   • city                — עיר נפרדת מהכתובת המלאה (Kaufman often needs to
--                            sort/filter by city without parsing free-text).
--
-- All fields nullable (progressive validation per project convention).
-- Audit trigger (012) iterates `to_jsonb(NEW)` so new columns get logged
-- automatically — no trigger changes needed.
-- =============================================================================

ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS id_issue_date DATE,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT
    CHECK (preferred_language IN ('he', 'en')),
  ADD COLUMN IF NOT EXISTS related_to_sellers BOOLEAN,
  ADD COLUMN IF NOT EXISTS landline_phone TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;

COMMENT ON COLUMN public.borrowers.id_issue_date
  IS 'תוקף ת״ז — banks require an unexpired Israeli ID.';
COMMENT ON COLUMN public.borrowers.preferred_language
  IS 'שפת תקשורת — drives template language and PDF output.';
COMMENT ON COLUMN public.borrowers.related_to_sellers
  IS 'האם הקונה קשור למוכרים — affects bank LTV cap and required docs.';
COMMENT ON COLUMN public.borrowers.landline_phone
  IS 'טלפון קווי — separate from `phone` (mobile).';
COMMENT ON COLUMN public.borrowers.city
  IS 'עיר — separate from `address` so we can filter/sort without parsing.';
