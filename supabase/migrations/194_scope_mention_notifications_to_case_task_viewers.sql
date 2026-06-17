-- =============================================================================
-- Migration 194: scope @-mention notifications to who can VIEW the case/task
--                (Theme D — NOTIF-1 / CC-1 / TC-1)
-- =============================================================================
-- The mention triggers inserted a notification (-> bell + email mirror, carrying
-- a 140-char body preview + the task title) for ANY active mentioned user, never
-- checking whether that user can view the case/task. So an advisor could @-mention
-- a teammate with no access and leak internal client chatter off-platform (email).
-- The composer also offered ALL active users as case-mention targets.
--
-- Mig 188 fixed the TASK *picker* (list_task_mentionable_profiles) but not the
-- task *trigger*, and the case path was unfixed on both sides. This migration:
--   * adds per-user view predicates can_view_case_for / can_view_task_for
--     (mirror can_view_case (147) / can_view_task (159) but parameterised by a
--     given user id, using has_permission_for (188) — has_permission uses
--     auth.uid() so it can't check a *mentioned* user).
--   * adds list_case_mentionable_profiles (mirrors mig 188's task picker) so the
--     case composer only offers teammates who can view the case.
--   * recreates notify_case_comment_mentions + notify_task_comment_mentions to
--     SKIP a mentioned user who can't view the case/task before inserting the
--     notification (defense-in-depth; the email mirror reads the same row).
--
-- SECURITY DEFINER + STABLE; the predicates evaluate a hypothetical user's
-- access, so they must bypass the mentioned user's own RLS. Idempotent.
-- Deps: 147 (can_view_case), 159 (can_view_task), 188 (has_permission_for),
-- 108/134 (the trigger bodies recreated here).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Per-user view predicates (parameterised by user id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_case_for(p_user_id UUID, p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
     WHERE c.id = p_case_id
       AND c.deleted_at IS NULL
       AND (
         public.has_permission_for(p_user_id, 'view_all_cases')
         OR (
           public.has_permission_for(p_user_id, 'view_own_cases')
           AND (
             c.assigned_advisor_id = p_user_id
             OR EXISTS (
               SELECT 1 FROM public.case_associated_advisors caa
                WHERE caa.case_id = c.id AND caa.advisor_id = p_user_id
             )
           )
         )
         OR (c.is_archived = TRUE AND public.has_permission_for(p_user_id, 'view_archived_cases'))
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_case_for(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_case_for(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_task_for(p_user_id UUID, p_task_id UUID)
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
       AND (t.is_private = FALSE OR t.created_by = p_user_id)
       AND (
         t.assigned_to = p_user_id
         OR t.assigned_by = p_user_id
         OR t.created_by = p_user_id
         OR public.has_permission_for(p_user_id, 'view_all_cases')
         OR (
           public.has_permission_for(p_user_id, 'view_own_cases')
           AND EXISTS (
             SELECT 1 FROM public.cases c
              WHERE c.id = t.case_id
                AND c.deleted_at IS NULL
                AND c.assigned_advisor_id = p_user_id
           )
         )
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_task_for(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_task_for(UUID, UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Scoped case-mention picker (mirrors list_task_mentionable_profiles, mig 188)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_case_mentionable_profiles(p_case_id UUID)
RETURNS TABLE(id UUID, first_name TEXT, last_name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN;
  END IF;
  -- Don't expose the mention list for a case the caller can't see.
  IF NOT public.can_view_case(p_case_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name
  FROM public.profiles p
  WHERE p.is_active = TRUE
    AND p.id <> v_caller
    AND public.can_view_case_for(p.id, p_case_id);
END;
$$;

REVOKE ALL ON FUNCTION public.list_case_mentionable_profiles(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_case_mentionable_profiles(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Recreate the mention triggers — skip mentioned users who can't view the
--    case/task (body unchanged from mig 108/134 except the added guard).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_case_comment_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := NEW.author_id;
  actor_name TEXT;
  mentioned_id UUID;
  preview TEXT;
BEGIN
  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  INTO actor_name
  FROM public.profiles
  WHERE id = actor;

  preview := left(
    regexp_replace(NEW.body, '@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)', '@\1', 'g'),
    140
  );

  FOR mentioned_id IN
    SELECT DISTINCT (m[1])::uuid
    FROM regexp_matches(
      NEW.body,
      '@\[[^\]]+\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)',
      'g'
    ) AS m
  LOOP
    -- Skip self, inactive/unknown users, AND anyone who can't view this case
    -- (else the bell + email mirror leak a comment preview cross-case).
    IF mentioned_id <> actor
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = mentioned_id AND p.is_active)
       AND public.can_view_case_for(mentioned_id, NEW.case_id) THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        mentioned_id, 'case_mention', NULL, NEW.case_id, actor,
        jsonb_build_object('actorName', actor_name, 'preview', preview, 'commentId', NEW.id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_task_comment_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := NEW.author_id;
  actor_name TEXT;
  mentioned_id UUID;
  preview TEXT;
  task_title TEXT;
  task_case_id UUID;
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'comment' THEN
    RETURN NEW;
  END IF;

  SELECT t.title, t.case_id
  INTO task_title, task_case_id
  FROM public.tasks t
  WHERE t.id = NEW.task_id
    AND t.deleted_at IS NULL;

  IF task_title IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  INTO actor_name
  FROM public.profiles
  WHERE id = actor;

  preview := left(
    regexp_replace(NEW.body, '@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)', '@\1', 'g'),
    140
  );

  FOR mentioned_id IN
    SELECT DISTINCT (m[1])::uuid
    FROM regexp_matches(
      NEW.body,
      '@\[[^\]]+\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)',
      'g'
    ) AS m
  LOOP
    -- Skip self, inactive/unknown users, AND anyone who can't view this task
    -- (else the bell + email mirror leak the task title + comment preview).
    IF mentioned_id <> actor
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = mentioned_id AND p.is_active)
       AND public.can_view_task_for(mentioned_id, NEW.task_id) THEN
      INSERT INTO public.notifications (user_id, type, task_id, case_id, actor_id, data)
      VALUES (
        mentioned_id, 'task_mention', NEW.task_id, task_case_id, actor,
        jsonb_build_object(
          'actorName', actor_name,
          'taskTitle', task_title,
          'preview', preview,
          'commentId', NEW.id
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

INSERT INTO public.schema_version (version) VALUES (194) ON CONFLICT DO NOTHING;
