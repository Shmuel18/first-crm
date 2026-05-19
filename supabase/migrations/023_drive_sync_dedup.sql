-- =============================================================================
-- Migration 023: Drive-sync de-duplication safety (#14)
-- =============================================================================
-- Purpose: Two concurrent calls to syncDriveDocumentsForCase could both INSERT
--          a documents row for the same drive_file_id (no unique constraint),
--          leaving the case with phantom duplicates. A unique index forces the
--          losing call to fail at the DB level; application code already
--          ignores INSERT errors silently, so the data lands consistently.
--
--          Partial index limits the constraint to *active* rows so a soft-
--          deleted document followed by a fresh Drive re-import still works.
-- Dependencies: 008_documents.sql
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_drive_file_active
  ON public.documents(case_id, drive_file_id)
  WHERE deleted_at IS NULL AND drive_file_id IS NOT NULL;
