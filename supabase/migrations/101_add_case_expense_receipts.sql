-- =============================================================================
-- Migration 101: invoice/receipt attachment on case_expenses (feature #8)
-- =============================================================================
-- Lets each office expense carry one uploaded invoice. The blob lives in the
-- existing 'case-documents' Storage bucket under
--   <case_id>/expenses/<uuid>.<ext>
-- so the per-case storage RLS (migrations 020 / 040, keyed on the first path
-- segment = case_id) already scopes object access to people who can see the
-- case. These columns store the pointer + display metadata. receipt_drive_url
-- is reserved for the (deferred, best-effort) Google Drive mirror.
--
-- No new RLS: case_expenses row access is already gated by migration 081, and
-- storage-object access by 020/040. Upload/remove go through server actions
-- that re-check userCanEditCase and use the service-role client for the blob
-- op — the product decision is "can edit the case", not the bucket's
-- upload_document permission.
-- =============================================================================

ALTER TABLE public.case_expenses
  ADD COLUMN IF NOT EXISTS receipt_path      TEXT,
  ADD COLUMN IF NOT EXISTS receipt_name      TEXT,
  ADD COLUMN IF NOT EXISTS receipt_mime      TEXT,
  ADD COLUMN IF NOT EXISTS receipt_drive_url TEXT;

COMMENT ON COLUMN public.case_expenses.receipt_path IS
  'Storage object path in the case-documents bucket for this expense''s invoice, or NULL when none. See migration 101 / feature #8.';
