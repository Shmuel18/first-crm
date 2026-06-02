-- =============================================================================
-- Migration 131: robust task reassignment RPC
-- =============================================================================
-- Reassigning a task can legitimately move it away from the current assignee.
-- Table RLS is easy to get wrong for that shape because the NEW row may no
-- longer be visible/editable to the actor. Keep the authorization rules explicit
-- here, then perform the update as SECURITY DEFINER so "return to creator" and
-- other handoffs do not depend on the task_update policy's WITH CHECK details.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reassign_task(
  p_task_id uuid,
  p_assignee_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
  v_assignee record;
  v_note text := NULLIF(TRIM(COALESCE(p_note, '')), '');
  v_assignee_name text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_assignee_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation');
  END IF;

  IF v_note IS NOT NULL AND char_length(v_note) > 4000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation');
  END IF;

  SELECT *
    INTO v_task
    FROM public.tasks
   WHERE id = p_task_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Private reminders are creator-only. Do not let view_all_cases expose or
  -- move someone else's private task through this definer function.
  IF v_task.is_private = true AND v_task.created_by IS DISTINCT FROM v_actor THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT (
    v_task.assigned_to IS NOT DISTINCT FROM v_actor
    OR v_task.created_by IS NOT DISTINCT FROM v_actor
    OR COALESCE(public.has_permission('view_all_cases'), false)
    OR COALESCE(public.is_admin(), false)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT id, first_name, last_name, is_active
    INTO v_assignee
    FROM public.profiles
   WHERE id = p_assignee_id;

  IF NOT FOUND OR v_assignee.is_active IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation');
  END IF;

  IF v_task.is_private = true AND p_assignee_id IS DISTINCT FROM v_task.created_by THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation');
  END IF;

  v_assignee_name := NULLIF(
    TRIM(COALESCE(v_assignee.first_name, '') || ' ' || COALESCE(v_assignee.last_name, '')),
    ''
  );

  IF v_task.assigned_to IS NOT DISTINCT FROM p_assignee_id THEN
    RETURN jsonb_build_object(
      'ok', true,
      'task_id', v_task.id,
      'case_id', v_task.case_id,
      'title', v_task.title,
      'no_change', true
    );
  END IF;

  UPDATE public.tasks
     SET assigned_to = p_assignee_id,
         updated_by = v_actor
   WHERE id = v_task.id;

  INSERT INTO public.task_comments (
    task_id,
    author_id,
    event_type,
    body,
    metadata
  )
  VALUES (
    v_task.id,
    v_actor,
    'reassigned',
    'הועברה ל' || COALESCE(v_assignee_name, 'יועץ'),
    jsonb_build_object('to_user_id', p_assignee_id, 'from_user_id', v_task.assigned_to)
  );

  IF v_note IS NOT NULL THEN
    INSERT INTO public.task_comments (
      task_id,
      author_id,
      event_type,
      body
    )
    VALUES (
      v_task.id,
      v_actor,
      'comment',
      v_note
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'task_id', v_task.id,
    'case_id', v_task.case_id,
    'title', v_task.title,
    'no_change', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reassign_task(uuid, uuid, text) TO authenticated;
