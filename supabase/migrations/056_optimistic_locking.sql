-- =============================================================================
-- Migration 056: Optimistic-lock version column on cases + borrowers
-- =============================================================================
-- Today every UPDATE is last-write-wins. Two advisors editing the same case
-- (the inline-edit cells on /cases make this trivially reproducible) silently
-- overwrite each other — the loser sees no error, no warning. The audit log
-- shows both writes as legitimate.
--
-- Fix: add a `version` column that increments on every UPDATE via trigger.
-- The TS action layer reads the version with the row, includes it in the
-- WHERE clause of the UPDATE (.eq('version', $v)), and surfaces "0 rows
-- affected" as a typed `conflict` error.
--
-- This migration is non-breaking: existing code that doesn't pass version
-- in the WHERE still works (the trigger silently bumps version anyway).
-- Code-side wiring is a follow-up — the migration alone gives the column
-- and the bump trigger, ready for callers to opt in.
-- =============================================================================

-- Cases
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

-- Borrowers (the other hot-edit surface)
ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.bump_row_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Skip when the caller explicitly set version (e.g. a future restore RPC
  -- that wants to preserve the captured value). Otherwise increment.
  IF NEW.version IS NOT DISTINCT FROM OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cases_bump_version ON public.cases;
CREATE TRIGGER trg_cases_bump_version
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_row_version();

DROP TRIGGER IF EXISTS trg_borrowers_bump_version ON public.borrowers;
CREATE TRIGGER trg_borrowers_bump_version
  BEFORE UPDATE ON public.borrowers
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_row_version();

COMMENT ON COLUMN public.cases.version IS
  'Optimistic-lock counter. Auto-incremented by bump_row_version on every UPDATE. Callers that pass this in a WHERE clause get conflict detection: 0 rows affected = a concurrent writer raced you.';
COMMENT ON COLUMN public.borrowers.version IS
  'See cases.version.';
