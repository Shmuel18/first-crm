-- =============================================================================
-- Migration 140: task_comments RLS — scope to parent-task visibility
-- =============================================================================
-- SECURITY FIX (P0, cross-case IDOR). Migration 120 shipped task_comments with:
--
--     CREATE POLICY "task_comments_select" ... USING (deleted_at IS NULL);
--
-- and a comment claiming "task visibility is enforced at the app layer". That
-- claim was false: getTaskCommentsAction only filters by task_id, so ANY
-- authenticated user (junior advisor, secretary) could read EVERY task's thread
-- office-wide via PostgREST + the anon key — including private tasks and cases
-- they are not assigned to. The INSERT policy was likewise open (any user could
-- post a comment / inject an @-mention into a task they cannot see).
--
-- Fix: gate both SELECT and INSERT on whether the caller can see the PARENT TASK.
-- The `EXISTS (SELECT 1 FROM public.tasks ...)` sub-select is evaluated as the
-- current `authenticated` role, so the tasks table's own RLS (`tasks_select`,
-- migration 098 — assignee / creator / view_all_cases, with private-task gating)
-- is enforced transitively. This means task-thread visibility now exactly tracks
-- task visibility, and any future change to `tasks_select` propagates here for
-- free (no duplicated logic to drift).
--
-- Safe-by-construction: each policy only ANDs an additional scope onto the
-- existing checks, so it can match the same rows or FEWER than before.
--
-- Verified by the two-advisor pgTAP test in supabase/tests/rls_permissions_test.sql.
-- =============================================================================

DROP POLICY IF EXISTS "task_comments_select" ON public.task_comments;
CREATE POLICY "task_comments_select" ON public.task_comments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
    )
  );

DROP POLICY IF EXISTS "task_comments_insert" ON public.task_comments;
CREATE POLICY "task_comments_insert" ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
    )
  );
