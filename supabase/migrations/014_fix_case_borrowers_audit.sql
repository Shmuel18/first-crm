-- =============================================================================
-- Migration 014: Remove Audit Trigger from case_borrowers
-- =============================================================================
-- Purpose: case_borrowers has composite PK (case_id, borrower_id) - no `id`.
--          The audit_log_change function uses NEW.id which would fail.
-- Solution: Drop the trigger. Adding/removing borrowers from cases will still
--          be auditable via the case's own audit trail and the borrower's creation log.
-- =============================================================================

DROP TRIGGER IF EXISTS trg_audit_case_borrowers ON public.case_borrowers;

-- Note: If we want to audit borrower-case associations more explicitly in the
-- future, we have 2 options:
--   1. Add an `id UUID` column to case_borrowers (simpler)
--   2. Modify audit_log to support composite keys (more flexible)
-- Both are deferred to Phase 2.
