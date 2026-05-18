-- =============================================================================
-- Migration 020: Tighten case-documents Storage RLS to per-case scope
-- =============================================================================
-- Purpose: 017's policies gated only on the GLOBAL has_permission flag, so any
--          authenticated user with view_case_documents could read every file
--          across all cases. Tighten by joining on the underlying case row to
--          ensure the file's case is one the user is actually allowed to see.
--
-- Object path convention (set in storagePathFor): <case_id>/<document_id>.<ext>
-- We extract case_id from the path's first segment with storage.foldername().
-- Dependencies: 017_documents_storage.sql, 011_rls_policies.sql (RLS on cases)
-- =============================================================================

DROP POLICY IF EXISTS "case_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "case_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "case_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "case_docs_delete" ON storage.objects;

-- Helper: the case_id is the first path segment
-- e.g. "1cbd0ce3-cf1d-4952-868a-381e77c7f1a5/abc.pdf"
-- (storage.foldername returns text[]; [1] is the first segment in PG)

CREATE POLICY "case_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND public.has_permission('view_case_documents')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "case_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-documents'
    AND public.has_permission('upload_document')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.deleted_at IS NULL
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
    )
  )
  WITH CHECK (
    bucket_id = 'case-documents'
    AND (public.has_permission('verify_document') OR public.has_permission('upload_document'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "case_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND public.has_permission('delete_document')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.deleted_at IS NULL
    )
  );

-- Note: we cannot COMMENT ON the policy because the storage schema is owned
-- by supabase_admin, not our role. The intent: reads only allowed if the
-- object's case (first path segment of the storage path) is visible to the
-- caller per public.cases RLS.
