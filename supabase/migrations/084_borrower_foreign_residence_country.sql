-- =============================================================================
-- Migration 084: Add foreign_residence_country to borrowers
-- =============================================================================
-- The borrower card replaces its single "אזרחות זרה?" question + 3-field
-- reveal with two narrower questions, each revealing a single country
-- dropdown:
--
--   * "האם ישנן אזרחויות נוספות?"  → writes the country to additional_citizenships
--   * "האם תושב חוץ?"              → writes the country to this new column
--                                    + flips residency_type to 'foreign_resident'
--
-- residency_type stays as the enum (resident / foreign_resident /
-- returning_resident) — it answers the YES/NO question. The new column
-- answers "where", and is NULL whenever residency_type isn't 'foreign_resident'.
-- Dependencies: 007_borrowers.sql (base table).
-- =============================================================================

ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS foreign_residence_country TEXT;

COMMENT ON COLUMN public.borrowers.foreign_residence_country
  IS 'Country of foreign residence when residency_type = foreign_resident. NULL otherwise.';
