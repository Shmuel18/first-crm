-- =============================================================================
-- Migration 028: In-App Notifications
-- =============================================================================
-- Purpose: Bell notifications for task events (assignment + completion).
-- Pattern: SECURITY DEFINER trigger on tasks writes rows here, mirroring the
--          audit_log trigger approach (012). Messages are stored as a type +
--          denormalized data snapshot so the client renders them via i18n and
--          they survive task rename/delete.
-- Dependencies: 002 (profiles), 006 (cases), 009 (tasks)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- recipient
  type TEXT NOT NULL CHECK (type IN ('task_assigned', 'task_completed')),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- who triggered it
  data JSONB NOT NULL DEFAULT '{}'::jsonb, -- { taskTitle, actorName }
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipients see / update (mark read) / delete only their own rows.
-- No INSERT policy: rows are created only by the SECURITY DEFINER trigger,
-- which bypasses RLS. This prevents users forging notifications for others.
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- Trigger: notify_task_change — fires on task insert/update
-- =============================================================================
CREATE OR REPLACE FUNCTION public.notify_task_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  actor_name TEXT;
BEGIN
  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  INTO actor_name
  FROM public.profiles
  WHERE id = actor;

  IF TG_OP = 'INSERT' THEN
    -- Notify the assignee when a task is created already assigned to someone
    -- other than the creator.
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM actor THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        NEW.assigned_to, 'task_assigned', NEW.id, NEW.case_id, actor,
        jsonb_build_object('taskTitle', NEW.title, 'actorName', actor_name)
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Reassignment: assigned_to changed to a new person (not the actor).
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       AND NEW.assigned_to IS NOT NULL
       AND NEW.assigned_to IS DISTINCT FROM actor THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        NEW.assigned_to, 'task_assigned', NEW.id, NEW.case_id, actor,
        jsonb_build_object('taskTitle', NEW.title, 'actorName', actor_name)
      );
    END IF;

    -- Completion: notify the creator when someone else completes their task.
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
       AND NEW.created_by IS NOT NULL
       AND NEW.created_by IS DISTINCT FROM actor THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        NEW.created_by, 'task_completed', NEW.id, NEW.case_id, actor,
        jsonb_build_object('taskTitle', NEW.title, 'actorName', actor_name)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_change ON public.tasks;
CREATE TRIGGER trg_notify_task_change
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_change();
