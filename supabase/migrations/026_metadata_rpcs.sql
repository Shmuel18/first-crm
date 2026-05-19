-- =============================================================================
-- Migration 026: Atomic JSONB metadata RPCs (#11)
-- =============================================================================
-- Replace read-modify-write JS patterns on cases.metadata.drive and
-- documents.metadata that race when two concurrent syncs / uploads touch
-- the same row.
--
-- Both RPCs use jsonb_set / `||` (concat) which run inside a single UPDATE
-- statement - PostgreSQL row-locks for the duration so concurrent calls
-- serialize at the row level. The caller only specifies a patch (partial
-- delta), never the whole metadata object, so they can't accidentally wipe
-- co-tenants' keys (storage_path, drive_missing_since, etc.).
-- Dependencies: 006 (cases), 008 (documents)
-- =============================================================================

-- =============================================================================
-- update_case_drive_meta(case_id, patch)
-- =============================================================================
-- Merges `patch` into cases.metadata.drive without touching the rest of
-- the metadata blob (e.g. seed_batch, future namespaces).
--
-- Example call:
--   supabase.rpc('update_case_drive_meta', {
--     p_case_id: caseId,
--     p_patch: { last_synced_at: '2026-05-18T...' },
--   })
CREATE OR REPLACE FUNCTION public.update_case_drive_meta(
  p_case_id UUID,
  p_patch JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.cases
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{drive}',
    COALESCE(metadata->'drive', '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb),
    TRUE
  )
  WHERE id = p_case_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_case_drive_meta(UUID, JSONB) TO authenticated;

-- =============================================================================
-- update_document_metadata(document_id, patch)
-- =============================================================================
-- Top-level merge into documents.metadata. Use for storage_path,
-- drive_missing_since, source, and any future per-doc metadata keys.
CREATE OR REPLACE FUNCTION public.update_document_metadata(
  p_document_id UUID,
  p_patch JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.documents
  SET metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb)
  WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document_metadata(UUID, JSONB) TO authenticated;
