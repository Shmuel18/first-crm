-- =============================================================================
-- Migration 027: Production hardening
-- =============================================================================
-- Closes batch-9 review findings:
--   #2  documents trusted-column guard trigger
--   #3  storage RLS parity with case edit permission
--   #5  case_financials_upsert RPC supports fail-loud financial save
--   #7  set_primary_bank: filter deleted_at on existing rows
--   #8  document_drive_tombstones table - blocks Drive sync from re-importing
--       documents the user just soft-deleted
--   #17 case_financials RLS: switch is_admin() → has_permission('view_case_fee')
--
-- Dependencies: 008, 011, 017, 020, 021, 022, 024, 025
-- =============================================================================

-- =============================================================================
-- #2: documents trusted-column guard
-- =============================================================================
-- The documents_update RLS in 024 lets any user with upload_document OR
-- verify_document edit ALL columns on a row they can write. That means an
-- uploader could flip status to 'verified' themselves, or rewrite
-- drive_file_url to a phishing link. Lock down trusted columns via trigger.
CREATE OR REPLACE FUNCTION public.guard_document_trusted_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- System paths (NULL session) and admins bypass the guard.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- status: only verify_document can change it (uploader can't self-verify).
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.has_permission('verify_document') THEN
      RAISE EXCEPTION 'Only verify_document permission can change document status';
    END IF;
  END IF;

  -- verified_by: same gate.
  IF NEW.verified_by IS DISTINCT FROM OLD.verified_by THEN
    IF NOT public.has_permission('verify_document') THEN
      RAISE EXCEPTION 'Only verify_document permission can set verified_by';
    END IF;
  END IF;

  -- drive_file_id / drive_file_url are trusted integration fields. App upload
  -- and Drive sync set them on INSERT; browser-visible UPDATE must not rewrite
  -- them later.
  IF NEW.drive_file_id IS DISTINCT FROM OLD.drive_file_id THEN
    RAISE EXCEPTION 'drive_file_id is immutable on documents';
  END IF;
  IF NEW.drive_file_url IS DISTINCT FROM OLD.drive_file_url THEN
    RAISE EXCEPTION 'drive_file_url is immutable on documents';
  END IF;

  -- Soft-delete is a trusted destructive field. Upload/verify permissions may
  -- still update metadata/category/status, but they cannot delete via UPDATE.
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF NOT public.has_permission('delete_document') THEN
      RAISE EXCEPTION 'Only delete_document permission can soft-delete documents';
    END IF;
  END IF;

  -- case_id is immutable - moving a document between cases would bypass case
  -- RLS in subtle ways. Use delete-and-reupload if needed.
  IF NEW.case_id IS DISTINCT FROM OLD.case_id THEN
    RAISE EXCEPTION 'case_id is immutable on documents';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_guard_trusted ON public.documents;
CREATE TRIGGER trg_documents_guard_trusted
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_document_trusted_columns();

-- =============================================================================
-- #3: storage RLS parity with case edit permission
-- =============================================================================
-- Migration 020 gated storage on permission + case visibility. With the
-- documents table now requiring case edit permission for write (migration
-- 024), storage must match - otherwise a viewer with upload_document could
-- still drop blobs straight into the bucket for a case they can't edit.
DROP POLICY IF EXISTS "case_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "case_docs_update" ON storage.objects;

CREATE POLICY "case_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-documents'
    AND public.has_permission('upload_document')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  );

CREATE POLICY "case_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND (public.has_permission('verify_document') OR public.has_permission('upload_document'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    bucket_id = 'case-documents'
    AND (public.has_permission('verify_document') OR public.has_permission('upload_document'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  );

-- (case_docs_select and case_docs_delete keep their existing semantics -
-- read mirrors view permission, delete is gated on delete_document.)

-- =============================================================================
-- #17: case_financials RLS via permission key (not is_admin)
-- =============================================================================
DROP POLICY IF EXISTS "case_financials_select" ON public.case_financials;
DROP POLICY IF EXISTS "case_financials_modify" ON public.case_financials;

CREATE POLICY "case_financials_select" ON public.case_financials
  FOR SELECT TO authenticated
  USING (public.has_permission('view_case_fee'));

CREATE POLICY "case_financials_modify" ON public.case_financials
  FOR ALL TO authenticated
  USING (public.has_permission('view_case_fee'))
  WITH CHECK (public.has_permission('view_case_fee'));

-- =============================================================================
-- #7: set_primary_bank filters deleted_at
-- =============================================================================
-- Previous version could promote a soft-deleted bank back to primary because
-- it didn't filter deleted_at. After 024 introduced soft-delete on case_banks,
-- this became a real bug: UI would show success, then the bank vanishes on
-- next list query.
CREATE OR REPLACE FUNCTION public.set_primary_bank(
  p_case_id UUID,
  p_bank_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Clear existing active primary (don't touch soft-deleted rows).
  UPDATE public.case_banks
    SET is_primary = FALSE,
        updated_by = p_user_id
    WHERE case_id = p_case_id
      AND is_primary = TRUE
      AND deleted_at IS NULL;

  IF p_bank_id IS NULL THEN
    RETURN;
  END IF;

  -- Promote an existing ACTIVE link only. A soft-deleted link is invisible
  -- here; the caller must explicitly restore via a separate flow if needed.
  UPDATE public.case_banks
    SET is_primary = TRUE,
        updated_by = p_user_id
    WHERE case_id = p_case_id
      AND bank_id = p_bank_id
      AND deleted_at IS NULL;

  IF NOT FOUND THEN
    -- No active link → insert a fresh one. The partial unique on
    -- (case_id, bank_id) WHERE deleted_at IS NULL (migration 024) allows
    -- this even if a soft-deleted row for the same pair already exists.
    INSERT INTO public.case_banks (case_id, bank_id, is_primary, created_by, updated_by)
    VALUES (p_case_id, p_bank_id, TRUE, p_user_id, p_user_id);
  END IF;
END;
$$;

-- =============================================================================
-- #5: case_financials_upsert RPC for transactional fail-loud save
-- =============================================================================
-- Returns whether the upsert was performed. The action layer treats `false`
-- (e.g., RLS rejection for a non-admin who submitted financial fields) as a
-- silent skip; a thrown exception means a real DB error → propagate.
CREATE OR REPLACE FUNCTION public.upsert_case_financials(
  p_case_id UUID,
  p_fee_amount NUMERIC,
  p_expected_income NUMERIC,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Permission check upfront: callers without view_case_fee silently skip
  -- (UI hides the fields, so a form submission with values is benign noise).
  IF NOT public.has_permission('view_case_fee') THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.case_financials (case_id, fee_amount, expected_income, created_by, updated_by)
  VALUES (p_case_id, p_fee_amount, p_expected_income, p_user_id, p_user_id)
  ON CONFLICT (case_id) DO UPDATE SET
    fee_amount = EXCLUDED.fee_amount,
    expected_income = EXCLUDED.expected_income,
    updated_by = EXCLUDED.updated_by;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_case_financials(UUID, NUMERIC, NUMERIC, UUID) TO authenticated;

-- =============================================================================
-- #8: document_drive_tombstones (suppress re-import of just-deleted Drive docs)
-- =============================================================================
-- When a document is soft-deleted, the Drive file stays put. The next sync
-- of that case sees the file, doesn't find it in active documents, and
-- happily re-imports it as a new doc - undoing the user's delete.
--
-- Tombstone table records drive_file_ids that should be ignored by sync.
-- delete-document inserts a tombstone; sync skips any drive_file_id present.
CREATE TABLE IF NOT EXISTS public.document_drive_tombstones (
  drive_file_id TEXT PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  deleted_document_id UUID,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_document_drive_tombstones_case
  ON public.document_drive_tombstones(case_id);

ALTER TABLE public.document_drive_tombstones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tombstones_select" ON public.document_drive_tombstones;
DROP POLICY IF EXISTS "tombstones_insert" ON public.document_drive_tombstones;
DROP POLICY IF EXISTS "tombstones_admin_purge" ON public.document_drive_tombstones;

-- Tombstones are read by sync (authenticated, any case it can see) and
-- written by delete-document. Admin can purge if needed.
CREATE POLICY "tombstones_select" ON public.document_drive_tombstones
  FOR SELECT TO authenticated
  USING (
    public.has_permission('view_case_documents')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "tombstones_insert" ON public.document_drive_tombstones
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('delete_document')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  );

CREATE POLICY "tombstones_admin_purge" ON public.document_drive_tombstones
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.soft_delete_document_with_tombstone(
  p_document_id UUID,
  p_case_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drive_file_id TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.has_permission('delete_document') THEN
    RAISE EXCEPTION 'Missing delete_document permission';
  END IF;

  SELECT d.drive_file_id
    INTO v_drive_file_id
    FROM public.documents d
    JOIN public.cases c ON c.id = d.case_id
   WHERE d.id = p_document_id
     AND d.case_id = p_case_id
     AND d.deleted_at IS NULL
     AND c.deleted_at IS NULL
     AND (
       public.has_permission('edit_any_case')
       OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
     )
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or not editable';
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
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_document_with_tombstone(UUID, UUID, UUID) TO authenticated;

COMMENT ON TABLE public.document_drive_tombstones IS
  'Drive file IDs whose documents were soft-deleted. Drive sync skips these so the same blob doesn''t get re-imported as a new document on the next pass.';
