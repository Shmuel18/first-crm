-- =============================================================================
-- Migration 029: Tasks RLS hardening (defense-in-depth)
-- =============================================================================
-- The task server actions validate case visibility, assignee, and do
-- soft-delete — but a direct (browser) Supabase client could bypass the
-- actions and hit the table under the looser RLS from 011/022. This migration
-- pushes those guarantees down to the database.
--
-- Findings addressed:
--   - tasks_insert only required created_by = auth.uid() (022) → also require a
--     visible/non-deleted case and an active assignee.
--   - tasks_update allowed editing any column → guard immutable audit columns,
--     validate reassignment + case moves (mirrors guard_document_trusted_columns).
--   - tasks_delete allowed hard DELETE → drop it; soft-delete only.
-- Dependencies: 002 (profiles, is_admin), 006 (cases), 009 (tasks), 011, 022
-- =============================================================================

-- Helper: active-profile check that bypasses the restrictive profiles RLS
-- (profiles_select_self_or_admin) so the insert/update checks below can verify
-- an assignee that the caller can't otherwise SELECT.
CREATE OR REPLACE FUNCTION public.is_active_profile(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND is_active = TRUE);
$$;

-- =============================================================================
-- 1) Tighten tasks_insert
-- =============================================================================
-- created_by must be the caller; a linked case must be visible (the cases RLS
-- filters this EXISTS) and not deleted; an assignee must be an active profile.
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      case_id IS NULL
      OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.deleted_at IS NULL)
    )
    AND (
      assigned_to IS NULL
      OR public.is_active_profile(assigned_to)
    )
  );

-- =============================================================================
-- 2) Guard task columns on UPDATE
-- =============================================================================
CREATE OR REPLACE FUNCTION public.guard_task_trusted_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- System paths (NULL session, e.g. seed/cleanup) and admins bypass.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Audit columns are immutable.
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable on tasks';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable on tasks';
  END IF;

  -- Reassigning must target an active profile. Keeping an existing assignee
  -- (even if later deactivated) is allowed — only a *change* is validated.
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NEW.assigned_to IS NOT NULL
     AND NOT public.is_active_profile(NEW.assigned_to) THEN
    RAISE EXCEPTION 'Cannot assign task to an inactive or unknown user';
  END IF;

  -- Moving to a different case requires the new case to exist and not be deleted.
  IF NEW.case_id IS DISTINCT FROM OLD.case_id
     AND NEW.case_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.cases c WHERE c.id = NEW.case_id AND c.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Cannot link task to a missing or deleted case';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_guard_trusted ON public.tasks;
CREATE TRIGGER trg_tasks_guard_trusted
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_task_trusted_columns();

-- =============================================================================
-- 3) Remove hard-delete policy — soft-delete (deleted_at) only
-- =============================================================================
-- With RLS enabled and no FOR DELETE policy, DELETE is denied for authenticated
-- users. The retention purge (cleanup_soft_deleted_records) is SECURITY DEFINER
-- and is unaffected.
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
