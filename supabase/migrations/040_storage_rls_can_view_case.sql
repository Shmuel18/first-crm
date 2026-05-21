-- =============================================================================
-- Migration 040: storage RLS uses can_view_case() (match 039-hardened table RLS)
-- =============================================================================
-- case_docs_select / case_docs_delete still scoped blob access via the implicit
-- transitive cases RLS (migration 020) — only checking the parent case EXISTS
-- and isn't soft-deleted. The insert/update policies were already made explicit
-- in 027. Re-state the read/delete scope explicitly through can_view_case() so a
-- future change that loosens cases_select can't silently widen document access
-- via signed URLs.
--
-- Safe-by-construction: ANDs the same case scope onto the existing checks, so
-- each policy can only match the same objects or fewer than before.
--
-- !!! VERIFY with the two-advisor storage IDOR test before relying on it:
-- as advisor B (view_own_cases only), createSignedUrl on a path under advisor
-- A's case_id must be denied.

GRANT EXECUTE ON FUNCTION public.can_view_case(uuid) TO authenticated;

DROP POLICY IF EXISTS "case_docs_select" ON storage.objects;
CREATE POLICY "case_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND public.has_permission('view_case_documents')
    AND public.can_view_case((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "case_docs_delete" ON storage.objects;
CREATE POLICY "case_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND public.has_permission('delete_document')
    AND public.can_view_case((storage.foldername(name))[1]::uuid)
  );
