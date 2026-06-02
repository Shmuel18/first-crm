-- =============================================================================
-- Migration 132: task assignment notification context
-- =============================================================================
-- Keep the existing notification type (`task_assigned`) for compatibility, but
-- add assignment context to the JSON payload so the bell can explain whether a
-- task was newly assigned, reassigned, or returned to its creator.
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
  assignment_kind TEXT;
BEGIN
  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  INTO actor_name
  FROM public.profiles
  WHERE id = actor;

  IF TG_OP = 'INSERT' THEN
    -- Notify the assignee only if it is NOT the person creating the task.
    IF NEW.assigned_to IS NOT NULL
       AND NEW.assigned_to IS DISTINCT FROM actor THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        NEW.assigned_to, 'task_assigned', NEW.id, NEW.case_id, actor,
        jsonb_build_object(
          'taskTitle', NEW.title,
          'actorName', actor_name,
          'priority', NEW.priority,
          'assignmentKind', 'assigned'
        )
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       AND NEW.assigned_to IS NOT NULL
       AND (NEW.assigned_to IS DISTINCT FROM actor OR NEW.priority = 'critical') THEN
      assignment_kind := CASE
        WHEN NEW.created_by IS NOT NULL
         AND NEW.assigned_to IS NOT DISTINCT FROM NEW.created_by
         AND OLD.assigned_to IS DISTINCT FROM NEW.created_by
          THEN 'returned_to_creator'
        ELSE 'reassigned'
      END;

      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        NEW.assigned_to, 'task_assigned', NEW.id, NEW.case_id, actor,
        jsonb_build_object(
          'taskTitle', NEW.title,
          'actorName', actor_name,
          'priority', NEW.priority,
          'assignmentKind', assignment_kind
        )
      );
    ELSIF NEW.priority = 'critical'
       AND OLD.priority IS DISTINCT FROM 'critical'
       AND NEW.status IN ('pending', 'in_progress')
       AND NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        NEW.assigned_to, 'task_assigned', NEW.id, NEW.case_id, actor,
        jsonb_build_object(
          'taskTitle', NEW.title,
          'actorName', actor_name,
          'priority', NEW.priority
        )
      );
    END IF;

    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
       AND NEW.created_by IS NOT NULL
       AND NEW.created_by IS DISTINCT FROM actor THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        NEW.created_by, 'task_completed', NEW.id, NEW.case_id, actor,
        jsonb_build_object(
          'taskTitle', NEW.title,
          'actorName', actor_name,
          'priority', NEW.priority
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
