-- =============================================================================
-- Migration 188: scope the task @-mention list to who can view the task (F11)
-- =============================================================================
-- The mention picker listed ALL active users, so an advisor could @-mention
-- (and notify + leak the task title/preview to) someone with no access to the
-- task. This adds an RPC that returns only the active users who can actually
-- VIEW the task — mirroring tasks_select (migration 159) — excluding the caller.
--
-- Needs a per-user permission check (has_permission uses auth.uid()), so this
-- also adds has_permission_for(user_id, key) — the same role-override-then-role
-- resolution as has_permission (migration 002), parameterised by user.
-- Dependencies: 002 (has_permission model), 157 (can_view_task), 159 (tasks_select).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_permission_for(p_user_id UUID, perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_id UUID;
  has_override BOOLEAN;
  override_granted BOOLEAN;
  has_role_perm BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT p.role_id INTO user_role_id
  FROM public.profiles p
  WHERE p.id = p_user_id AND p.is_active = TRUE;

  IF user_role_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- User-level override takes precedence over the role grant.
  SELECT EXISTS(
    SELECT 1
    FROM public.user_permission_overrides uo
    JOIN public.permissions p ON p.id = uo.permission_id
    WHERE uo.user_id = p_user_id AND p.key = perm_key
  ) INTO has_override;

  IF has_override THEN
    SELECT uo.is_granted INTO override_granted
    FROM public.user_permission_overrides uo
    JOIN public.permissions p ON p.id = uo.permission_id
    WHERE uo.user_id = p_user_id AND p.key = perm_key;
    RETURN override_granted;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = user_role_id
      AND p.key = perm_key
      AND rp.is_granted = TRUE
  ) INTO has_role_perm;

  RETURN COALESCE(has_role_perm, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.has_permission_for(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission_for(UUID, TEXT) TO authenticated;

-- Active users who can VIEW the task (mirrors tasks_select, mig 159), minus the
-- caller. Empty for a private task (only its creator sees it — and you don't
-- mention yourself), or when the caller can't view the task at all.
CREATE OR REPLACE FUNCTION public.list_task_mentionable_profiles(p_task_id UUID)
RETURNS TABLE(id UUID, first_name TEXT, last_name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      UUID := auth.uid();
  v_is_private  BOOLEAN;
  v_created_by  UUID;
  v_assigned_to UUID;
  v_case_id     UUID;
  v_advisor     UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN;
  END IF;

  SELECT t.is_private, t.created_by, t.assigned_to, t.case_id
  INTO v_is_private, v_created_by, v_assigned_to, v_case_id
  FROM public.tasks t
  WHERE t.id = p_task_id AND t.deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Don't expose the mention list for a task the caller can't see.
  IF NOT public.can_view_task(p_task_id) THEN
    RETURN;
  END IF;

  -- Responsible advisor of the task's case (the view_own_cases branch).
  IF v_case_id IS NOT NULL THEN
    SELECT c.assigned_advisor_id INTO v_advisor
    FROM public.cases c
    WHERE c.id = v_case_id AND c.deleted_at IS NULL;
  END IF;

  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name
  FROM public.profiles p
  WHERE p.is_active = TRUE
    AND p.id <> v_caller
    AND (v_is_private = FALSE OR v_created_by = p.id)
    AND (
      p.id = v_assigned_to
      OR p.id = v_created_by
      OR public.has_permission_for(p.id, 'view_all_cases')
      OR (
        v_advisor IS NOT NULL
        AND p.id = v_advisor
        AND public.has_permission_for(p.id, 'view_own_cases')
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.list_task_mentionable_profiles(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_task_mentionable_profiles(UUID) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (188) ON CONFLICT DO NOTHING;
