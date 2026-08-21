-- =============================================================================
-- Migration 230: documents are accepted immediately (no review queue)
-- =============================================================================
-- Kaufman's document workflow treats a successfully filed document as valid
-- immediately. Keep the legacy status/verification columns for rolling-deploy
-- and backup compatibility, but make `verified` the only state an active row
-- can have. Historical soft-deleted rows keep their original state.
--
-- Dependencies: 027 (trusted-column guard), 143 (schema version),
--               192 (canonical document/storage policies)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_document_trusted_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restoring_backup BOOLEAN :=
    COALESCE(current_setting('app.restoring_backup', true), 'false') = 'true';
BEGIN
  -- An active document is accepted by definition. This keeps old app builds
  -- and old backup payloads that still submit new/rejected/expired compatible
  -- during a rolling deploy.
  IF NEW.deleted_at IS NULL THEN
    NEW.status := 'verified';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- The pre-230 Drive importer did not stamp uploaded_by. Attribute that
    -- trusted, authenticated insert without letting a caller forge another
    -- user: a non-null foreign actor is left intact and rejected by RLS.
    IF NOT v_restoring_backup AND auth.uid() IS NOT NULL AND NEW.uploaded_by IS NULL THEN
      NEW.uploaded_by := auth.uid();
    END IF;
    RETURN NEW;
  END IF;

  -- Backup restore is a SECURITY DEFINER maintenance path and must retain the
  -- historical uploader/verifier fields from the snapshot. Status above is
  -- still normalized because restored documents become active.
  IF v_restoring_backup THEN
    RETURN NEW;
  END IF;

  -- Verification attribution is historical compatibility data now. Browser
  -- clients cannot invent or erase it; old review buttons become harmless
  -- no-ops during the short rolling-deploy overlap.
  IF auth.uid() IS NOT NULL THEN
    NEW.verified_by := OLD.verified_by;
    NEW.verified_at := OLD.verified_at;
  END IF;

  -- System/direct-SQL paths and admins keep the established maintenance
  -- bypass. The active-status constraint below still applies to everybody.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Document status is system managed';
  END IF;

  IF NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
    RAISE EXCEPTION 'uploaded_by is immutable on documents';
  END IF;

  -- Drive pointers are trusted integration fields. Browser-visible updates
  -- must not rewrite them to another file or an attacker-controlled URL.
  IF NEW.drive_file_id IS DISTINCT FROM OLD.drive_file_id THEN
    RAISE EXCEPTION 'drive_file_id is immutable on documents';
  END IF;
  IF NEW.drive_file_url IS DISTINCT FROM OLD.drive_file_url THEN
    RAISE EXCEPTION 'drive_file_url is immutable on documents';
  END IF;

  -- Destructive changes continue to require the dedicated capability and RPC.
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF NOT public.has_permission('delete_document') THEN
      RAISE EXCEPTION 'Only delete_document permission can soft-delete documents';
    END IF;
  END IF;

  IF NEW.case_id IS DISTINCT FROM OLD.case_id THEN
    RAISE EXCEPTION 'case_id is immutable on documents';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_guard_trusted ON public.documents;
CREATE TRIGGER trg_documents_guard_trusted
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_document_trusted_columns();

-- This is a genuine business-state change, so keep the normal audit and
-- updated-at triggers enabled. Null audit actor correctly denotes migration.
UPDATE public.documents
   SET status = 'verified'
 WHERE deleted_at IS NULL
   AND status <> 'verified';

ALTER TABLE public.documents
  ALTER COLUMN status SET DEFAULT 'verified';

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_status_check
  CHECK (
    status IN ('new', 'verified', 'rejected', 'expired', 'not_relevant')
    AND (deleted_at IS NOT NULL OR status = 'verified')
  ) NOT VALID;
ALTER TABLE public.documents
  VALIDATE CONSTRAINT documents_status_check;

COMMENT ON COLUMN public.documents.status IS
  'Active documents are accepted immediately and always use verified. Legacy states remain valid only on soft-deleted history rows.';
COMMENT ON COLUMN public.documents.verified_by IS
  'Legacy human-review attribution retained for historical/backup compatibility; no longer written by the application.';
COMMENT ON COLUMN public.documents.verified_at IS
  'Legacy human-review timestamp retained for historical/backup compatibility; no longer written by the application.';

-- Verification is no longer a capability. Upload permission + canonical case
-- edit authority are the only document filing/update gates.
DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('upload_document')
    AND public.can_edit_case(case_id)
    AND deleted_at IS NULL
    AND status = 'verified'
    AND verified_by IS NULL
    AND verified_at IS NULL
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('upload_document')
    AND public.can_edit_case(case_id)
    AND deleted_at IS NULL
  )
  WITH CHECK (
    public.has_permission('upload_document')
    AND public.can_edit_case(case_id)
    AND deleted_at IS NULL
    AND status = 'verified'
  );

DROP POLICY IF EXISTS "case_docs_update" ON storage.objects;
CREATE POLICY "case_docs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND public.has_permission('upload_document')
    AND public.can_edit_case((storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'case-documents'
    AND public.has_permission('upload_document')
    AND public.can_edit_case((storage.foldername(name))[1]::uuid)
  );

NOTIFY pgrst, 'reload schema';

INSERT INTO public.schema_version (version) VALUES (230) ON CONFLICT DO NOTHING;
