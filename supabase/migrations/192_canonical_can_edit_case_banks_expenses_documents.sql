-- =============================================================================
-- Migration 192: canonicalize the REMAINING case-child write authorization on
--                public.can_edit_case / public._assert_can_edit_case (Theme A)
-- =============================================================================
-- Round 8 (mig 190) canonicalized borrower / income / obligation writes on
-- public.can_edit_case (= edit_any_case OR (edit_own_case AND (assigned advisor
-- OR associated advisor)), incl. the case-not-deleted check). The Round 9-11
-- review found the IDENTICAL legacy guard
--   "has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid()"
-- still gating writes for case_banks (mig 024), case_expenses (mig 081),
-- documents (mig 024), the case-documents STORAGE policies (mig 027), and the
-- document/expense soft-delete RPCs. That legacy check predates associated
-- advisors (mig 146/147), so an associated advisor legitimately on a case
-- CANNOT add/edit a bank, expense, or document (or its underlying storage
-- object) — a silently-RLS-denied core flow for that role.
--
-- This migration repoints every one of those write paths at can_edit_case /
-- _assert_can_edit_case, WHILE PRESERVING the document/storage-specific
-- permission gates (upload_document / verify_document / delete_document) that
-- layer on top of case-edit authority.
--
-- SAFE BY CONSTRUCTION: can_edit_case is a SUPERSET of the legacy case check
-- (it additionally admits associated advisors), so this only WIDENS access to
-- users who already legitimately edit the case — it never grants a user who
-- lacked edit authority. Reads (case_*_select, case_docs_select/delete) already
-- went through can_view_case (mig 039/040) and are intentionally untouched.
-- Idempotent (DROP POLICY IF EXISTS + CREATE / CREATE OR REPLACE).
-- Deps: 024, 027, 081, 104, 147.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. case_banks INSERT / UPDATE  (was mig 024)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "case_banks_insert" ON public.case_banks;
CREATE POLICY "case_banks_insert" ON public.case_banks
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_case(case_id));

DROP POLICY IF EXISTS "case_banks_update" ON public.case_banks;
CREATE POLICY "case_banks_update" ON public.case_banks
  FOR UPDATE TO authenticated
  USING (public.can_edit_case(case_id))
  WITH CHECK (public.can_edit_case(case_id));

-- -----------------------------------------------------------------------------
-- 2. case_expenses INSERT / UPDATE + soft-delete RPC  (was mig 081)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "case_expenses_insert" ON public.case_expenses;
CREATE POLICY "case_expenses_insert" ON public.case_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND public.can_edit_case(case_id)
  );

DROP POLICY IF EXISTS "case_expenses_update" ON public.case_expenses;
CREATE POLICY "case_expenses_update" ON public.case_expenses
  FOR UPDATE TO authenticated
  USING (public.can_edit_case(case_id))
  WITH CHECK (public.can_edit_case(case_id));

CREATE OR REPLACE FUNCTION public.soft_delete_case_expense(
  p_case_id    UUID,
  p_expense_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  -- Canonical case-edit guard (admin / responsible / associated advisor).
  PERFORM public._assert_can_edit_case(p_case_id);

  IF NOT EXISTS (
    SELECT 1
      FROM public.case_expenses e
     WHERE e.id = p_expense_id
       AND e.case_id = p_case_id
       AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'case expense not found on this case' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.case_expenses
     SET deleted_at = now(),
         deleted_by = v_actor,
         updated_by = v_actor
   WHERE id = p_expense_id
     AND case_id = p_case_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_case_expense(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_case_expense(UUID, UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. documents INSERT / UPDATE  (was mig 024) — keep the upload_document /
--    verify_document gate; swap ONLY the legacy case check for can_edit_case.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('upload_document')
    AND public.can_edit_case(case_id)
  );

DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    (public.has_permission('verify_document') OR public.has_permission('upload_document'))
    AND public.can_edit_case(case_id)
  )
  WITH CHECK (
    (public.has_permission('verify_document') OR public.has_permission('upload_document'))
    AND public.can_edit_case(case_id)
  );

-- -----------------------------------------------------------------------------
-- 4. case-documents STORAGE policies (storage.objects) INSERT / UPDATE
--    (was mig 027) — keep the doc-permission gate; the case id is the first
--    path segment. SELECT/DELETE already use can_view_case (mig 040), untouched.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "case_docs_insert" ON storage.objects;
CREATE POLICY "case_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-documents'
    AND public.has_permission('upload_document')
    AND public.can_edit_case((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "case_docs_update" ON storage.objects;
CREATE POLICY "case_docs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND (public.has_permission('verify_document') OR public.has_permission('upload_document'))
    AND public.can_edit_case((storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'case-documents'
    AND (public.has_permission('verify_document') OR public.has_permission('upload_document'))
    AND public.can_edit_case((storage.foldername(name))[1]::uuid)
  );

-- -----------------------------------------------------------------------------
-- 5. document tombstone INSERT policy + soft-delete RPC  (was mig 027/104) —
--    keep delete_document; swap the legacy case check for the canonical guard.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "tombstones_insert" ON public.document_drive_tombstones;
CREATE POLICY "tombstones_insert" ON public.document_drive_tombstones
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('delete_document')
    AND public.can_edit_case(case_id)
  );

CREATE OR REPLACE FUNCTION public.soft_delete_document_with_tombstone(
  p_document_id UUID,
  p_case_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_drive_file_id TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission('delete_document') THEN
    RAISE EXCEPTION 'Missing delete_document permission' USING ERRCODE = '42501';
  END IF;

  -- Canonical case-edit guard (admin / responsible / associated advisor) —
  -- replaces the legacy assigned_advisor-only check.
  PERFORM public._assert_can_edit_case(p_case_id);

  SELECT d.drive_file_id
    INTO v_drive_file_id
    FROM public.documents d
   WHERE d.id = p_document_id
     AND d.case_id = p_case_id
     AND d.deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or not editable' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.documents
     SET deleted_at = NOW()
   WHERE id = p_document_id;

  IF v_drive_file_id IS NOT NULL THEN
    INSERT INTO public.document_drive_tombstones (
      drive_file_id,
      case_id,
      deleted_document_id,
      deleted_by
    )
    VALUES (v_drive_file_id, p_case_id, p_document_id, p_user_id)
    ON CONFLICT (drive_file_id) DO UPDATE SET
      case_id = EXCLUDED.case_id,
      deleted_document_id = EXCLUDED.deleted_document_id,
      deleted_at = NOW(),
      deleted_by = EXCLUDED.deleted_by;
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.soft_delete_document_with_tombstone(UUID, UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

INSERT INTO public.schema_version (version) VALUES (192) ON CONFLICT DO NOTHING;
