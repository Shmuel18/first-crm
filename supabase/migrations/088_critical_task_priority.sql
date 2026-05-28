-- =============================================================================
-- Migration 088: Critical task priority
-- =============================================================================
-- Adds a top-tier task priority for "must be handled in the next few minutes".
-- This is deliberately a separate value above "high" so ordinary urgent tasks
-- do not constantly animate the UI.
-- =============================================================================

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('low', 'normal', 'high', 'critical'));

CREATE INDEX IF NOT EXISTS idx_tasks_critical_active
  ON public.tasks(assigned_to, status, due_date)
  WHERE priority = 'critical'
    AND deleted_at IS NULL
    AND status IN ('pending', 'in_progress');

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
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM actor THEN
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

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       AND NEW.assigned_to IS NOT NULL
       AND NEW.assigned_to IS DISTINCT FROM actor THEN
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

CREATE OR REPLACE FUNCTION public.layout_bootstrap()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_profile JSONB;
  v_role JSONB;
  v_is_admin BOOLEAN;
  v_pending_tasks INT;
  v_critical_tasks INT;
  v_unread INT;
  v_recent_notifications JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT to_jsonb(p)
    INTO v_profile
    FROM public.profiles p
   WHERE p.id = v_actor;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'name_he', r.name_he,
    'name_en', r.name_en
  ) INTO v_role
    FROM public.roles r
   WHERE r.id = (v_profile ->> 'role_id')::UUID;

  v_is_admin := public.is_admin();

  SELECT COUNT(*) INTO v_pending_tasks
    FROM public.tasks
   WHERE assigned_to = v_actor
     AND status = 'pending'
     AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_critical_tasks
    FROM public.tasks
   WHERE assigned_to = v_actor
     AND priority = 'critical'
     AND status IN ('pending', 'in_progress')
     AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_unread
    FROM public.notifications
   WHERE user_id = v_actor
     AND read_at IS NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(n) ORDER BY n.created_at DESC), '[]'::jsonb)
    INTO v_recent_notifications
    FROM (
      SELECT id, user_id, actor_id, type, case_id, task_id, data, read_at, created_at
        FROM public.notifications
       WHERE user_id = v_actor
       ORDER BY created_at DESC
       LIMIT 15
    ) n;

  RETURN jsonb_build_object(
    'authenticated', true,
    'is_admin', v_is_admin,
    'pending_tasks', v_pending_tasks,
    'critical_tasks', v_critical_tasks,
    'unread_notifications', v_unread,
    'profile', COALESCE(v_profile, '{}'::jsonb) || jsonb_build_object('role', v_role),
    'recent_notifications', v_recent_notifications
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.layout_bootstrap() TO authenticated;
