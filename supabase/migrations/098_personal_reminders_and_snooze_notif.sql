-- =============================================================================
-- Migration 098: Personal (private) task reminders + task_reminder notification
-- =============================================================================
-- Feature A — "reminder to myself": a private task is visible ONLY to its
--   creator (even an admin with view_all_cases can't see it). Private tasks
--   must be self-assigned. snoozed_until already exists (009), so the snooze
--   "nudnik" needs no new column — only the notification type below.
-- Feature B — task_reminder bell notification, emitted by the resurface cron
--   when a snoozed task's snoozed_until passes.
-- Dependencies: 009 (tasks), 011 (tasks_select), 028/068 (notifications)
-- =============================================================================

-- 1) Private flag ----------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- A private task must be assigned to its creator (a reminder to oneself).
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_private_self_assigned;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_private_self_assigned
  CHECK (is_private = false OR (assigned_to IS NOT NULL AND assigned_to = created_by));

-- 2) Visibility: hide others' private tasks even from view_all_cases ------------
-- Preserves the existing visibility (assignee / creator / view_all_cases) but
-- gates it behind a privacy clause. Since private tasks are self-assigned, the
-- creator still sees them via the OR below; everyone else is blocked.
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    (is_private = false OR created_by = auth.uid())
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR public.has_permission('view_all_cases')
    )
  );

-- 3) Allow the task_reminder notification type ---------------------------------
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('task_assigned', 'task_completed', 'case_status_overdue', 'task_reminder'));
