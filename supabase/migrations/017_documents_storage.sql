-- =============================================================================
-- Migration 017: Documents - Storage Bucket + Status Refinement
-- =============================================================================
-- Purpose:
--   1. Add 'not_relevant' status (advisor marks requirement as N/A for this case)
--   2. Create 'case-documents' storage bucket (private) for file blobs
--   3. RLS policies on storage.objects: mirror documents-table permissions
-- Dependencies: 008_documents.sql, 011_rls_policies.sql
-- =============================================================================

-- =============================================================================
-- 1. Add 'not_relevant' to documents.status CHECK
-- =============================================================================
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('new', 'verified', 'rejected', 'expired', 'not_relevant'));

COMMENT ON COLUMN public.documents.status IS
  'new = uploaded/pending review · verified = approved · rejected = needs replacement · expired = past expiry_date · not_relevant = requirement marked N/A (placeholder row, no file)';

-- =============================================================================
-- 2. Create storage bucket 'case-documents' (private)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-documents',
  'case-documents',
  FALSE,
  20971520, -- 20MB per file
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- 3. RLS policies on storage.objects for case-documents bucket
-- =============================================================================
-- Object path convention: <case_id>/<document_id>.<ext>
-- Permission gating mirrors public.documents policies via has_permission()

-- SELECT: anyone with view_case_documents can read any object in the bucket
DROP POLICY IF EXISTS "case_docs_select" ON storage.objects;
CREATE POLICY "case_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND public.has_permission('view_case_documents')
  );

-- INSERT: anyone with upload_document can upload
DROP POLICY IF EXISTS "case_docs_insert" ON storage.objects;
CREATE POLICY "case_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-documents'
    AND public.has_permission('upload_document')
  );

-- UPDATE: anyone with verify_document or upload_document
DROP POLICY IF EXISTS "case_docs_update" ON storage.objects;
CREATE POLICY "case_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND (public.has_permission('verify_document') OR public.has_permission('upload_document'))
  )
  WITH CHECK (
    bucket_id = 'case-documents'
    AND (public.has_permission('verify_document') OR public.has_permission('upload_document'))
  );

-- DELETE: anyone with delete_document
DROP POLICY IF EXISTS "case_docs_delete" ON storage.objects;
CREATE POLICY "case_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND public.has_permission('delete_document')
  );
