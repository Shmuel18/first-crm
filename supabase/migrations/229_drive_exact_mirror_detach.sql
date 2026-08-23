-- =============================================================================
-- Migration 229: Drive exact-mirror detach
-- =============================================================================
-- A Drive-sync disappearance means the file was trashed OR moved outside the
-- managed case-folder tree. The site must hide it immediately, but retention
-- must never later delete a still-live file that now belongs somewhere else.
--
-- This migration adds a service-only reconciliation RPC which atomically:
--   * soft-deletes the document row;
--   * clears its active Drive pointers;
--   * records the former Drive id and triggering actor in metadata for audit;
--   * deliberately does NOT write document_drive_tombstones, so moving the same
--     file back under the case can import it again.
--
-- The RPC is callable only through the service-role client after the server
-- action has authenticated an editor with upload permission. Keeping the RPC
-- off the authenticated API prevents a browser client from disguising an
-- arbitrary document deletion as reconciliation.
-- Dependencies: 027 (trusted document guard)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_drive_document_without_tombstone(
  p_document_id UUID,
  p_case_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drive_file_id TEXT;
  v_detached_at TIMESTAMPTZ := NOW();
  v_updated BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service-role reconciliation only' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing reconciliation actor' USING ERRCODE = '22004';
  END IF;

  SELECT d.drive_file_id
    INTO v_drive_file_id
    FROM public.documents d
   WHERE d.id = p_document_id
     AND d.case_id = p_case_id
     AND d.deleted_at IS NULL
     AND d.drive_file_id IS NOT NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.documents
     SET deleted_at = v_detached_at,
         drive_file_id = NULL,
         drive_file_url = NULL,
         metadata = CASE
           WHEN jsonb_typeof(metadata) = 'object' THEN metadata
           ELSE '{}'::jsonb
         END || jsonb_build_object(
           'drive_detached_file_id', v_drive_file_id,
           'drive_detached_at', v_detached_at,
           'drive_detached_by', p_user_id,
           'drive_detach_reason', 'missing_or_outside_managed_case_tree'
         )
   WHERE id = p_document_id
     AND case_id = p_case_id
     AND deleted_at IS NULL;

  v_updated := FOUND;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_drive_document_without_tombstone(UUID, UUID, UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_drive_document_without_tombstone(UUID, UUID, UUID)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_drive_document_without_tombstone(UUID, UUID, UUID)
  TO service_role;

COMMENT ON FUNCTION public.soft_delete_drive_document_without_tombstone(UUID, UUID, UUID) IS
  'Service-only exact-mirror reconciliation: soft-delete a Drive document that left its managed case tree, detach active Drive pointers, and write no tombstone so it can be re-imported if it returns.';

NOTIFY pgrst, 'reload schema';

INSERT INTO public.schema_version (version) VALUES (229) ON CONFLICT DO NOTHING;
