-- =============================================================================
-- Migration 159: task assignment attribution + history
-- =============================================================================
-- Store who performed the latest assignment and keep an append-only assignment
-- history. The triggers cover every write path, including normal task edits,
-- the reassign_task RPC, admin handoffs, and future automations.
-- Dependencies: 009 (tasks), 002 (profiles), 157 (can_view_task).
-- =============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by
  ON public.tasks(assigned_by);

-- The latest assigner keeps read access so "assigned by me" remains useful
-- after handing the task to somebody else.
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    (is_private = false OR created_by = auth.uid())
    AND (
      assigned_to = auth.uid()
      OR assigned_by = auth.uid()
      OR created_by = auth.uid()
      OR public.has_permission('view_all_cases')
      OR (
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

-- Keep child resources (history and task attachments) aligned with the task's
-- actual select policy.
CREATE OR REPLACE FUNCTION public.can_view_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
     WHERE t.id = p_task_id
       AND t.deleted_at IS NULL
       AND (t.is_private = FALSE OR t.created_by = auth.uid())
       AND (
         t.assigned_to = auth.uid()
         OR t.assigned_by = auth.uid()
         OR t.created_by = auth.uid()
         OR public.has_permission('view_all_cases')
         OR (
           public.has_permission('view_own_cases')
           AND EXISTS (
             SELECT 1 FROM public.cases c
              WHERE c.id = t.case_id
                AND c.deleted_at IS NULL
                AND c.assigned_advisor_id = auth.uid()
           )
         )
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_task(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_task(UUID) TO authenticated;

-- Existing assignments predate attribution. The creator is the best available
-- source for their initial assignment context.
UPDATE public.tasks
   SET assigned_by = COALESCE(created_by, updated_by),
       assigned_at = COALESCE(created_at, updated_at)
 WHERE assigned_to IS NOT NULL
   AND assigned_at IS NULL;

CREATE TABLE IF NOT EXISTS public.task_assignment_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  assigned_from UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_assignment_history_task
  ON public.task_assignment_history(task_id, assigned_at DESC);

ALTER TABLE public.task_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_assignment_history_select" ON public.task_assignment_history;
CREATE POLICY "task_assignment_history_select" ON public.task_assignment_history
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id));

-- Attribution columns are derived, not caller-controlled. For an automated or
-- service-role write, auth.uid() can be null; updated_by/created_by preserve an
-- actor when the write path supplied one, otherwise the UI renders "System".
CREATE OR REPLACE FUNCTION public.stamp_task_assignment_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF current_setting('app.restoring_backup', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
      NEW.assigned_by := COALESCE(v_actor, NEW.created_by, NEW.updated_by);
      NEW.assigned_at := NOW();
    ELSE
      NEW.assigned_by := NULL;
      NEW.assigned_at := NULL;
    END IF;
  ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NEW.assigned_to IS NOT NULL THEN
      NEW.assigned_by := COALESCE(
        v_actor,
        CASE WHEN NEW.updated_by IS DISTINCT FROM OLD.updated_by THEN NEW.updated_by END
      );
      NEW.assigned_at := NOW();
    ELSE
      -- These columns describe the current assignment. The actor who removed
      -- it is captured separately in task_assignment_history.
      NEW.assigned_by := NULL;
      NEW.assigned_at := NULL;
    END IF;
  ELSE
    NEW.assigned_by := OLD.assigned_by;
    NEW.assigned_at := OLD.assigned_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_stamp_assignment_context ON public.tasks;
CREATE TRIGGER trg_tasks_stamp_assignment_context
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.stamp_task_assignment_context();

CREATE OR REPLACE FUNCTION public.record_task_assignment_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF current_setting('app.restoring_backup', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.task_assignment_history (
      task_id, assigned_from, assigned_to, assigned_by, assigned_at
    )
    VALUES (
      NEW.id, NULL, NEW.assigned_to, NEW.assigned_by, COALESCE(NEW.assigned_at, NOW())
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.task_assignment_history (
      task_id, assigned_from, assigned_to, assigned_by, assigned_at
    )
    VALUES (
      NEW.id,
      OLD.assigned_to,
      NEW.assigned_to,
      COALESCE(
        NEW.assigned_by,
        v_actor,
        CASE WHEN NEW.updated_by IS DISTINCT FROM OLD.updated_by THEN NEW.updated_by END
      ),
      COALESCE(NEW.assigned_at, NOW())
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_record_assignment_history ON public.tasks;
CREATE TRIGGER trg_tasks_record_assignment_history
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.record_task_assignment_history();

-- Seed one best-effort initial history row for currently assigned tasks.
INSERT INTO public.task_assignment_history (
  task_id, assigned_from, assigned_to, assigned_by, assigned_at
)
SELECT
  t.id,
  NULL,
  t.assigned_to,
  t.assigned_by,
  COALESCE(t.assigned_at, t.created_at)
FROM public.tasks t
WHERE t.assigned_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM public.task_assignment_history h
     WHERE h.task_id = t.id
  );

REVOKE ALL ON FUNCTION public.stamp_task_assignment_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_task_assignment_history() FROM PUBLIC;

COMMENT ON COLUMN public.tasks.assigned_by IS
  'Profile that performed the latest assignment. Null means system/automation.';
COMMENT ON COLUMN public.tasks.assigned_at IS
  'Timestamp of the current assignment. Null while the task is unassigned.';
COMMENT ON TABLE public.task_assignment_history IS
  'Append-only history of task assignment and unassignment changes.';

-- Completion notifications now go to the person who last assigned the task,
-- with creator as a legacy fallback. Assignment notifications keep the actor
-- snapshot already used by the bell.
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
  completion_recipient UUID;
BEGIN
  IF current_setting('app.restoring_backup', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
    INTO actor_name
    FROM public.profiles
   WHERE id = actor;

  IF TG_OP = 'INSERT' THEN
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

    completion_recipient := COALESCE(NEW.assigned_by, NEW.created_by);
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
       AND completion_recipient IS NOT NULL
       AND completion_recipient IS DISTINCT FROM actor THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        completion_recipient, 'task_completed', NEW.id, NEW.case_id, actor,
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

-- Assignment attribution and history are durable business data, so include the
-- history table in backups. The transaction-local flag prevents task restore
-- inserts from being restamped as if the restoring admin assigned every task,
-- and prevents synthetic duplicate history rows during restore.
CREATE OR REPLACE FUNCTION public.restore_backup_snapshot(p_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables text[] := ARRAY[
    'roles', 'permissions', 'banks', 'case_statuses', 'case_types',
    'document_categories', 'income_types', 'holidays', 'profiles', 'office_settings',
    'role_permissions', 'user_permission_overrides', 'borrowers', 'cases', 'leads',
    'case_borrowers', 'case_banks', 'case_financials', 'case_type_documents', 'documents',
    'borrower_incomes', 'borrower_obligations', 'tasks', 'task_assignment_history',
    'reminder_rules', 'stage_durations', 'mortgage_scenarios', 'scenario_tracks'
  ];
  v_tables_with_deleted_at text[] := ARRAY[
    'leads', 'borrowers', 'cases', 'tasks', 'documents',
    'case_banks', 'borrower_incomes', 'borrower_obligations',
    'mortgage_scenarios', 'scenario_tracks'
  ];
  v_tbl text;
  v_rows jsonb;
  v_inserted bigint;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF COALESCE((p_snapshot->>'version')::int, 0) <> 1 THEN
    RAISE EXCEPTION 'unsupported backup version' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.restoring_backup', 'true', true);

  FOREACH v_tbl IN ARRAY v_tables LOOP
    v_rows := p_snapshot->'data'->v_tbl;
    IF v_rows IS NULL OR jsonb_typeof(v_rows) <> 'array' OR jsonb_array_length(v_rows) = 0 THEN
      v_result := v_result || jsonb_build_object(v_tbl, 0);
      CONTINUE;
    END IF;

    IF v_tbl = ANY(v_tables_with_deleted_at) THEN
      SELECT jsonb_agg(elem - 'deleted_at') INTO v_rows
        FROM jsonb_array_elements(v_rows) AS elem;
    END IF;

    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING',
      v_tbl, v_tbl
    ) USING v_rows;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_result := v_result || jsonb_build_object(v_tbl, v_inserted);
  END LOOP;

  PERFORM set_config('app.restoring_backup', 'false', true);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup_snapshot(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_backup_snapshot(jsonb) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (159) ON CONFLICT DO NOTHING;
