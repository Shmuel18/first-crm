-- =============================================================================
-- Migration 157: task_attachments — general documents on case-less tasks
-- =============================================================================
-- A task created WITHOUT a case has no client, no case Drive folder and no row
-- in `documents` (documents.case_id is NOT NULL + case-scoped Storage RLS).
-- This table is the home for "general / office" files attached to such a task:
--   - blob lives in a dedicated `task-documents` Storage bucket, NOT the
--     case-scoped `case-documents` bucket (whose RLS casts the first path
--     segment to a case uuid and would reject a tasks/<id> path).
--   - the Drive copy goes to a standalone "general documents" folder, not under
--     KFG_Cases — wired in TS (drive-general-uploader.ts).
--
-- Visibility inherits the task's own: whoever can see the task can see its
-- attachments. Encapsulated in can_view_task() so the table RLS and the
-- Storage RLS share one definition.
-- Dependencies: 009 (tasks), 098 (tasks.is_private + tasks_select), 017/020
--   (storage buckets + per-case storage RLS), 002 (has_permission, is_admin).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Visibility helper — mirrors tasks_select (098). SECURITY DEFINER so it can
--    read tasks without recursing through that table's own RLS, while still
--    scoping to the calling user via auth.uid().
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
     WHERE t.id = p_task_id
       AND t.deleted_at IS NULL
       AND (t.is_private = FALSE OR t.created_by = auth.uid())
       AND (
         t.assigned_to = auth.uid()
         OR t.created_by = auth.uid()
         OR public.has_permission('view_all_cases')
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_task(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_task(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) The table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name      TEXT NOT NULL,
  file_size      BIGINT NOT NULL,
  mime_type      TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  drive_file_id  TEXT,
  drive_file_url TEXT,
  uploaded_by    UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task
  ON public.task_attachments(task_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT — whoever can see the parent task.
DROP POLICY IF EXISTS "task_attachments_select" ON public.task_attachments;
CREATE POLICY "task_attachments_select" ON public.task_attachments
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id));

-- INSERT — must own the row, hold upload_document, and see the task.
DROP POLICY IF EXISTS "task_attachments_insert" ON public.task_attachments;
CREATE POLICY "task_attachments_insert" ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.has_permission('upload_document')
    AND public.can_view_task(task_id)
  );

-- DELETE — the uploader or an admin (hard delete; the blob + Drive copy are
-- cleaned up by the server action before the row is removed).
DROP POLICY IF EXISTS "task_attachments_delete" ON public.task_attachments;
CREATE POLICY "task_attachments_delete" ON public.task_attachments
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin());

COMMENT ON TABLE public.task_attachments IS
  'General/office files on case-less tasks. Blob in the task-documents bucket, '
  'optional Drive copy in a standalone general folder. See migration 157.';

-- -----------------------------------------------------------------------------
-- 3) Dedicated Storage bucket + per-task RLS
--    Path convention: <task_id>/<attachment_id>.<ext>
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-documents', 'task-documents', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "task_docs_select" ON storage.objects;
CREATE POLICY "task_docs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-documents'
    AND public.can_view_task((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "task_docs_insert" ON storage.objects;
CREATE POLICY "task_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-documents'
    AND public.has_permission('upload_document')
    AND public.can_view_task((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "task_docs_delete" ON storage.objects;
CREATE POLICY "task_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-documents'
    AND (owner = auth.uid() OR public.is_admin())
  );

INSERT INTO public.schema_version (version) VALUES (157) ON CONFLICT DO NOTHING;
