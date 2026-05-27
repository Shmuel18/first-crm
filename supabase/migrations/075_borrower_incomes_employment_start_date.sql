-- =============================================================================
-- Migration 075: borrower_incomes.employment_start_date
-- =============================================================================
-- The case-page incomes block now asks for an employment start date and
-- displays seniority (ותק) computed from that date — drift-free vs. storing
-- tenure_months which would have to be hand-bumped or recomputed nightly.
--
-- tenure_months stays on the table for back-compat with any historical
-- rows / restored backups; new writes from the UI go through the date.
-- Display falls back to tenure_months only when the date column is NULL.
-- =============================================================================

ALTER TABLE public.borrower_incomes
  ADD COLUMN IF NOT EXISTS employment_start_date DATE;

-- Sanity: a future date doesn't represent "seniority" — guard at the DB so
-- a typo (2026 instead of 2016) doesn't silently produce a negative tenure.
ALTER TABLE public.borrower_incomes
  DROP CONSTRAINT IF EXISTS borrower_incomes_employment_start_not_future;

ALTER TABLE public.borrower_incomes
  ADD CONSTRAINT borrower_incomes_employment_start_not_future
  CHECK (employment_start_date IS NULL OR employment_start_date <= CURRENT_DATE);
