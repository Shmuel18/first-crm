-- Migration 104: Ensure document soft-delete RPC exists on remote DB
-- Purpose:
--   Production code calls soft_delete_document_with_tombstone from the
--   document preview modal. Some environments had the application code
--   deployed while PostgREST's schema cache did not expose the RPC, causing
--   document deletes to fail with "function not found in schema cache".
--
-- This migration is intentionally idempotent. It recreates the tombstone table
-- and RPC shape expected by the app, then asks PostgREST to reload its schema.

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

COMMENT ON FUNCTION public.soft_delete_document_with_tombstone(UUID, UUID, UUID) IS
  'Soft-deletes a document and records a Drive tombstone so sync will not re-import the same Drive file.';

NOTIFY pgrst, 'reload schema';
