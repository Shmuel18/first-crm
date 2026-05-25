-- =============================================================================
-- Migration 044: Borrower personal-detail extras
-- =============================================================================
-- Purpose: Round out the inline-editable borrower card with four fields that
--          the Module 2 spec implies but weren't in the schema yet.
--
--   • gender                    — מגדר. Banks ask for this on every form;
--                                  not derivable from name reliably.
--   • id_expiry_date            — תוקף ת״ז (expiry). Pairs with the existing
--                                  id_issue_date (issue date) — most banks
--                                  reject submissions with an expired ID.
--   • relationship_in_case      — קשר בין הלווים. Free text: "נשואים", "אחים",
--                                  "הורה-ילד", "שותפים עסקיים", etc. Stored
--                                  per borrower (each writes their own POV)
--                                  rather than as a case-level junction —
--                                  simpler for an MVP, no UI for pair-typing.
--   • additional_citizenships   — אזרחויות נוספות (free text, e.g. "בריטניה"
--                                  or "ארה״ב, צרפת"). The existing
--                                  citizenship column is the primary one;
--                                  this one captures secondary passports.
--
-- All nullable (progressive validation per project convention).
-- =============================================================================

ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IN ('male', 'female', 'other')),
  ADD COLUMN IF NOT EXISTS id_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS relationship_in_case TEXT,
  ADD COLUMN IF NOT EXISTS additional_citizenships TEXT;

COMMENT ON COLUMN public.borrowers.gender
  IS 'מגדר — male / female / other. Banks require this on forms.';
COMMENT ON COLUMN public.borrowers.id_expiry_date
  IS 'תוקף תעודת זהות — banks reject submissions with an expired ID.';
COMMENT ON COLUMN public.borrowers.relationship_in_case
  IS 'קשר בין הלווים בתיק — free text per borrower (POV).';
COMMENT ON COLUMN public.borrowers.additional_citizenships
  IS 'אזרחויות נוספות מעבר ל-citizenship הראשי, free text.';
