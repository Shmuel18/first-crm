-- =============================================================================
-- Migration 182: a task's assignee/assigner gets READ access to its case
-- =============================================================================
-- Reported: Kaufman assigns an advisor a task on a case the advisor isn't the
-- responsible/associated advisor of. The advisor can see the TASK (tasks_select
-- allows assigned_to/assigned_by/created_by) but NOT the case — so the task's
-- embedded case comes back NULL and the linked client never shows. Worse, the
-- edit dialog can't represent the invisible case, so saving the task would
-- submit an empty case_id and silently UNLINK it (update-task case_id ?? null).
--
-- Decision (with the user): give anyone who can see a task READ access to its
-- linked case — full context (case row + borrowers/client name + banks +
-- documents …), NOT edit. Implemented by adding ONE OR-branch wherever case READ
-- is gated, via a new SECURITY DEFINER predicate (mirrors is_case_associated_advisor):
--   * cases_select   (case row read, mig 011 → 147)
--   * can_view_case()(child-table read helper, mig 039 → 147 — propagates to
--                     documents / incomes / obligations / expenses / banks /
--                     comments / checklist / scenarios / storage)
-- Because EVERY task-viewer now also views the case, the embed is never NULL for
-- them and the unlink bug cannot occur.
--
-- SAFE BY CONSTRUCTION (same principle as mig 147): each change only ADDS an
-- OR-branch — it can at most fail to grant, never lock out existing access.
-- can_edit_case / cases_update are intentionally UNCHANGED (read, not edit).
-- DEFINER predicate avoids cases→tasks→cases RLS recursion. Reproduces the 147
-- definitions verbatim with the single new branch added.
--
-- Idempotent. Deps: 147 (current cases_select + can_view_case), 159 (tasks
-- assigned_by), 009 (tasks). Migration-only — no code change; the existing embed
-- starts resolving once access is granted.
-- =============================================================================

-- Does the current user have a live task on this case (as assignee, assigner, or
-- creator)? SECURITY DEFINER so the cases policy can read tasks without invoking
-- tasks RLS (which itself reads cases) — no recursion.
CREATE OR REPLACE FUNCTION public.is_case_task_member(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.case_id = p_case_id
      AND t.deleted_at IS NULL
      AND (
        t.assigned_to = auth.uid()
        OR t.assigned_by = auth.uid()
        OR t.created_by = auth.uid()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_case_task_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_case_task_member(uuid) TO authenticated;

-- --- cases read: responsible OR associated OR task-member -----------------------
DROP POLICY IF EXISTS "cases_select" ON public.cases;
CREATE POLICY "cases_select" ON public.cases FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission('view_all_cases')
      OR (
        public.has_permission('view_own_cases')
        AND (assigned_advisor_id = auth.uid() OR public.is_case_associated_advisor(id))
      )
      OR (is_archived = TRUE AND public.has_permission('view_archived_cases'))
      OR public.is_case_task_member(id)
    )
  );

-- --- child-table read helper: + task-member ------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_case(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cases c
    WHERE c.id = p_case_id
      AND c.deleted_at IS NULL
      AND (
        public.has_permission('view_all_cases')
        OR (
          public.has_permission('view_own_cases')
          AND (c.assigned_advisor_id = auth.uid() OR public.is_case_associated_advisor(c.id))
        )
        OR (c.is_archived = TRUE AND public.has_permission('view_archived_cases'))
        OR public.is_case_task_member(c.id)
      )
  );
$$;

INSERT INTO public.schema_version (version) VALUES (182) ON CONFLICT DO NOTHING;
