-- =============================================================================
-- Migration 042: index unindexed foreign keys on cases
-- =============================================================================
-- Postgres does not auto-index FK columns. assigned_advisor_id already has
-- idx_cases_advisor; these cover the remaining FKs that get joined/filtered
-- (and that ON DELETE SET NULL scans when a profiles row is removed).

CREATE INDEX IF NOT EXISTS idx_cases_primary_borrower ON public.cases(primary_borrower_id);
CREATE INDEX IF NOT EXISTS idx_cases_type_secondary ON public.cases(case_type_secondary_id);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON public.cases(created_by);
CREATE INDEX IF NOT EXISTS idx_cases_updated_by ON public.cases(updated_by);
