-- Add 'in_progress' to the task status set — the Kanban board's "in work"
-- column. Existing rows are unaffected; the value is simply now permitted.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'snoozed', 'cancelled'));
