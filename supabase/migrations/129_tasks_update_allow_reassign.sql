-- =============================================================================
-- Migration 129: let task reassignment actually go through (tasks_update RLS)
-- =============================================================================
-- The tasks_update policy (mig 011) was USING-only:
--     USING (assigned_to = auth.uid() OR created_by = auth.uid() OR is_admin())
-- With no separate WITH CHECK, Postgres applies the USING expression to the NEW
-- row too. So when the assignee hands a task OFF (new assigned_to = someone
-- else), the new row no longer satisfies USING for the actor → the UPDATE
-- matches 0 rows → reassignTaskAction reports it as failed ("העברת המשימה
-- נכשלה"). The same blocked a secretary (view_all_cases, not admin) from
-- reassigning a task they don't personally hold.
--
-- Fix, matching the office rule "anyone with access to the case can hand a task
-- to anyone with access to the case":
--   USING       — who may edit this task: its assignee, its creator, anyone with
--                 view_all_cases (manager / secretary), or an admin.
--   WITH CHECK  — TRUE: the actor (already gated by USING) may set the new
--                 values, INCLUDING reassigning away from themselves. Integrity
--                 is still enforced by the guard trigger from migration 029
--                 (created_by / created_at immutable; assigned_to must be an
--                 active profile), and the assignee picker only offers active
--                 team members.
-- =============================================================================

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.has_permission('view_all_cases')
    OR public.is_admin()
  )
  WITH CHECK (true);
