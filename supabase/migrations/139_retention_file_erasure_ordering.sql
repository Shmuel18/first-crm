-- =============================================================================
-- Migration 139: Retention purge must not orphan PII files, and must keep
-- retention BOUNDED (LEGAL-3 right-to-erasure) — documents + expense receipts
-- =============================================================================
-- BUG: cleanup_soft_deleted_records() hard-deleted soft-deleted `documents`
-- rows (and cascade via `cases`) before the app-layer cron erased the Storage
-- blob + Google Drive copy — SQL cannot reach Storage/Drive — so the files
-- leaked forever. The same hole existed for `case_expenses` receipts (which had
-- NO purge at all).
--
-- FIX — the purge depends on file erasure instead of racing it, with a hard
-- time bound so nothing is retained forever:
--   * A row is finalized only once BOTH its Storage pointer AND its Drive
--     pointer are gone (the cron erases each and nulls the pointer). Both gate,
--     because a document can exist Drive-only (drive_file_id set, NO
--     storage_path — that is exactly how Drive-sync imports them), so gating on
--     Storage alone would purge it on day one and orphan the live Drive file.
--   * BACKSTOP: any row soft-deleted longer than retention + RETENTION_FILE_
--     GRACE_DAYS (30) is finalized REGARDLESS of pointers. This bounds retention
--     even if Drive is permanently disconnected or a blob is unreachable; any
--     file the cron could not erase by then is left for manual cleanup (product
--     decision) — bounded, not forever.
--   * documents: purge when (storage_path IS NULL AND drive_file_id IS NULL) OR
--     past the backstop.
--   * case_expenses: purge when (receipt_path IS NULL AND receipt_drive_id IS
--     NULL) OR past the backstop. (NEW — never purged before.)
--   * cases: purge when no surviving child document/expense has any pointer, OR
--     past the backstop. Else the cascade would delete those child rows (losing
--     the pointers) before the cron erases the files.
--
-- The cron (cleanup-orphaned-blobs → retention-file-eraser) erases + nulls both
-- pointers for directly-soft-deleted AND cascade-doomed documents + expenses,
-- on the configured retention window. Adds case_expenses.receipt_drive_id so the
-- Drive mirror is erasable by id (only the web link was stored before).
--
-- Correctness is order-independent: a purge that runs before the cron simply
-- SKIPS rows that still have a pointer (within the backstop); the cron erases
-- them; the next purge finalizes. The backstop guarantees termination.
--
-- Idempotent (CREATE OR REPLACE + ADD COLUMN IF NOT EXISTS). The pg_cron
-- schedule (migration 057) picks up the new body automatically.
-- Dependencies: 022 (prior body), 008 (documents), 081/101 (case_expenses), 010.
-- =============================================================================

ALTER TABLE public.case_expenses
  ADD COLUMN IF NOT EXISTS receipt_drive_id TEXT;

COMMENT ON COLUMN public.case_expenses.receipt_drive_id IS
  'Google Drive file id of the receipt mirror (erasable by id). Paired with receipt_drive_url (web link). NULL when no Drive copy. See migration 139.';

CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Extra grace, after the recovery window, for the cron to erase files before
  -- the row is force-finalized regardless of pointers (bounds retention even
  -- when Drive is unreachable or a blob is missing).
  grace_days CONSTANT INT := 30;
  retention_days INT;
  cutoff TIMESTAMPTZ;
  backstop TIMESTAMPTZ;
  count_leads INT;
  count_cases INT;
  count_borrowers INT;
  count_documents INT;
  count_case_banks INT;
  count_tasks INT;
  count_case_expenses INT;
BEGIN
  SELECT deleted_records_retention_days INTO retention_days
  FROM public.office_settings WHERE id = 1;
  retention_days := GREATEST(1, COALESCE(retention_days, 14));
  cutoff   := NOW() - (retention_days || ' days')::INTERVAL;
  backstop := NOW() - ((retention_days + grace_days) || ' days')::INTERVAL;

  DELETE FROM public.leads WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_leads = ROW_COUNT;

  -- Cases: skip while any child document/expense still has a Storage OR Drive
  -- pointer (the cascade would orphan those files) — unless past the backstop.
  DELETE FROM public.cases c
   WHERE c.deleted_at IS NOT NULL AND c.deleted_at < cutoff
     AND (
       (
         NOT EXISTS (
           SELECT 1 FROM public.documents d
            WHERE d.case_id = c.id
              AND ((d.metadata->>'storage_path') IS NOT NULL OR d.drive_file_id IS NOT NULL)
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.case_expenses e
            WHERE e.case_id = c.id
              AND (e.receipt_path IS NOT NULL OR e.receipt_drive_id IS NOT NULL)
         )
       )
       OR c.deleted_at < backstop
     );
  GET DIAGNOSTICS count_cases = ROW_COUNT;

  DELETE FROM public.borrowers WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_borrowers = ROW_COUNT;

  -- Documents: finalize once BOTH file pointers are erased, or past the backstop.
  DELETE FROM public.documents
   WHERE deleted_at IS NOT NULL AND deleted_at < cutoff
     AND (
       ((metadata->>'storage_path') IS NULL AND drive_file_id IS NULL)
       OR deleted_at < backstop
     );
  GET DIAGNOSTICS count_documents = ROW_COUNT;

  -- Expense receipts: same contract; previously never purged at all.
  DELETE FROM public.case_expenses
   WHERE deleted_at IS NOT NULL AND deleted_at < cutoff
     AND (
       (receipt_path IS NULL AND receipt_drive_id IS NULL)
       OR deleted_at < backstop
     );
  GET DIAGNOSTICS count_case_expenses = ROW_COUNT;

  DELETE FROM public.case_banks WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_case_banks = ROW_COUNT;

  DELETE FROM public.tasks WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  GET DIAGNOSTICS count_tasks = ROW_COUNT;

  RETURN jsonb_build_object(
    'leads', count_leads,
    'cases', count_cases,
    'borrowers', count_borrowers,
    'documents', count_documents,
    'case_expenses', count_case_expenses,
    'case_banks', count_case_banks,
    'tasks', count_tasks,
    'cutoff', cutoff,
    'backstop', backstop
  );
END;
$$;
