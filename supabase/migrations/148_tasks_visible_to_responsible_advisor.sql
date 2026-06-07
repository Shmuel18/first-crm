-- =============================================================================
-- Migration 148: the RESPONSIBLE advisor sees ALL (non-private) tasks on a case
-- =============================================================================
-- Today tasks_select (mig 098) shows a task only to its assignee, its creator,
-- or a view_all_cases holder — it is NOT case-scoped. So a responsible advisor
-- with view_own_cases does not see a task on their own case that the manager
-- created and assigned to someone else. This adds that: the responsible advisor
-- (cases.assigned_advisor_id = me) sees every non-private task on their cases.
--
-- DELIBERATELY responsible-only: associated advisors (mig 146) are NOT given
-- blanket task visibility here — per product decision they see only tasks
-- assigned to them (assigned_to = me, already covered). They can still be
-- assigned a task via the normal assignee picker. (Assigning ONE task to several
-- people at once is a separate, deferred change — task_assignees.)
--
-- SAFE BY CONSTRUCTION: adds one OR-branch; never removes an existing one. The
-- private-task guard is preserved verbatim. Reproduces mig 098 + the new branch.
--
-- Idempotent (DROP+CREATE policy). Deps: 098 (prior tasks_select), 006 (cases).
-- =============================================================================

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    (is_private = false OR created_by = auth.uid())
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR public.has_permission('view_all_cases')
      OR (
        -- Responsible advisor of the task's case sees all its tasks.
        public.has_permission('view_own_cases')
        AND EXISTS (
          SELECT 1 FROM public.cases c
           WHERE c.id = tasks.case_id
             AND c.deleted_at IS NULL
             AND c.assigned_advisor_id = auth.uid()
        )
      )
    )
  );

INSERT INTO public.schema_version (version) VALUES (148) ON CONFLICT DO NOTHING;
