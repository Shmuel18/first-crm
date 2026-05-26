-- =============================================================================
-- Migration 052: CHECK constraints on monetary + date fields
-- =============================================================================
-- The audit found multiple NUMERIC and DATE columns with no value-range
-- constraint, so a typo (or hostile input) can store a negative property
-- value, an income paid in the year 9999, a birthday in the future, etc.
-- Dashboard aggregates and reports silently break.
--
-- PRE-DEPLOYMENT CHECK — before applying this migration, run:
--   SELECT id, property_value FROM public.cases WHERE property_value < 0;
--   SELECT id, requested_mortgage_amount FROM public.cases WHERE requested_mortgage_amount < 0;
--   SELECT id, equity FROM public.cases WHERE equity < 0;
--   SELECT case_id, fee_amount, expected_income FROM public.case_financials
--    WHERE fee_amount < 0 OR expected_income < 0;
--   SELECT id, amount_monthly FROM public.borrower_incomes WHERE amount_monthly < 0;
--   SELECT id, monthly_payment, loan_amount FROM public.borrower_obligations
--    WHERE monthly_payment < 0 OR loan_amount < 0;
--   SELECT id, birth_date FROM public.borrowers WHERE birth_date > CURRENT_DATE;
--   SELECT id, id_issue_date, id_expiry_date FROM public.borrowers
--    WHERE id_issue_date > id_expiry_date;
--   SELECT id, file_name, file_size FROM public.documents
--    WHERE file_size IS NOT NULL AND (file_size < 0 OR file_size > 524288000);
-- Clean up any violations before running this — the ALTER TABLE will fail
-- on existing bad rows.
-- =============================================================================

-- Monetary: cases
ALTER TABLE public.cases
  ADD CONSTRAINT cases_property_value_nn
    CHECK (property_value IS NULL OR property_value >= 0),
  ADD CONSTRAINT cases_requested_mortgage_amount_nn
    CHECK (requested_mortgage_amount IS NULL OR requested_mortgage_amount >= 0),
  ADD CONSTRAINT cases_equity_nn
    CHECK (equity IS NULL OR equity >= 0);

-- Monetary: case_financials
ALTER TABLE public.case_financials
  ADD CONSTRAINT case_financials_fee_amount_nn
    CHECK (fee_amount IS NULL OR fee_amount >= 0),
  ADD CONSTRAINT case_financials_expected_income_nn
    CHECK (expected_income IS NULL OR expected_income >= 0);

-- Monetary: borrower_incomes
ALTER TABLE public.borrower_incomes
  ADD CONSTRAINT borrower_incomes_amount_monthly_nn
    CHECK (amount_monthly IS NULL OR amount_monthly >= 0);

-- Monetary: borrower_obligations (column names per migration 007)
ALTER TABLE public.borrower_obligations
  ADD CONSTRAINT borrower_obligations_monthly_payment_nn
    CHECK (monthly_payment IS NULL OR monthly_payment >= 0),
  ADD CONSTRAINT borrower_obligations_loan_amount_nn
    CHECK (loan_amount IS NULL OR loan_amount >= 0);

-- Document file size: 500 MB upper bound. Note: the Supabase Storage bucket
-- caps direct uploads at 20 MB (matches MAX_FILE_SIZE_BYTES in the schema +
-- next.config.ts bodySizeLimit). But the `documents` table also records
-- Drive-sourced files (drive-document-sync writes whatever Drive reports —
-- Drive itself has a 5 TB ceiling). Capping the table at the bucket limit
-- would reject any Drive document larger than 20 MB (e.g. a scanned PDF
-- portfolio or a slide deck). 500 MB covers virtually every real mortgage
-- document while still catching genuinely-corrupt values (GB-scale, negative).
ALTER TABLE public.documents
  ADD CONSTRAINT documents_file_size_range
    CHECK (file_size IS NULL OR (file_size >= 0 AND file_size <= 524288000));

-- Dates: birthday in the past; ID issue <= ID expiry
ALTER TABLE public.borrowers
  ADD CONSTRAINT borrowers_birth_date_past
    CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE),
  ADD CONSTRAINT borrowers_id_dates_ordered
    CHECK (
      id_issue_date IS NULL
      OR id_expiry_date IS NULL
      OR id_issue_date <= id_expiry_date
    );
