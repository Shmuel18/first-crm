-- =============================================================================
-- Migration 038: allow 'EXPORT' as an audit_log action
-- =============================================================================
-- Bulk exports of the case list (XLSX / PDF) surface client names + national
-- IDs, so they must leave an audit trail. The original CHECK constraint only
-- permitted the per-row trigger actions (INSERT/UPDATE/DELETE/SOFT_DELETE/
-- RESTORE); widen it so an export event can be recorded explicitly.

ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_action_check;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_action_check
  CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE', 'EXPORT'));
