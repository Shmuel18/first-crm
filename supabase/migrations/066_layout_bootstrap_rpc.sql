-- =============================================================================
-- Migration 066: layout_bootstrap() — single round-trip for the app shell
-- =============================================================================
-- The (app) layout + Topbar currently fire 5 sequential round-trips on every
-- page navigation:
--   1. is_admin (RPC)
--   2. countPendingTasksForUser → tasks COUNT
--   3. getMyProfile → profiles SELECT + roles JOIN
--   4. countUnreadNotifications → notifications COUNT
--   5. listRecentNotifications → notifications SELECT
--
-- Plus an auth.getUser() call inside most of these. At 1 user that's
-- ~5 × 30ms = 150ms baked into every page load. At 50 concurrent users
-- the Supabase connection pool starts queuing — every layout render
-- pulls 5+ connections for the duration.
--
-- This RPC consolidates all five into a single SECURITY DEFINER call
-- that returns one JSONB envelope. The layout reads it once and passes
-- the values down through props. Server-side React `cache()` then
-- dedupes across the AppLayout → Topbar → Sidebar render tree.
--
-- Cost model:
--   - Before: 5 queries × N concurrent users = 5N connection-seconds
--   - After:  1 query × N = N connection-seconds (5× headroom)
-- =============================================================================

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
  v_pending_tasks INT;
  v_unread INT;
  v_recent_notifications JSONB;
  v_is_admin BOOLEAN;
BEGIN
  IF v_actor IS NULL THEN
    -- Unauthed callers get an empty envelope (the layout itself handles the
    -- redirect; this RPC just avoids leaking anything).
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  -- Profile + role in one shot. Mirrors getMyProfile().
  SELECT to_jsonb(p) - 'metadata' INTO v_profile
    FROM public.profiles p
   WHERE p.id = v_actor;

  IF v_profile IS NOT NULL THEN
    SELECT jsonb_build_object(
      'name_he', r.name_he,
      'name_en', r.name_en
    ) INTO v_role
      FROM public.roles r
     WHERE r.id = (v_profile ->> 'role_id')::UUID;
  END IF;

  -- is_admin: re-uses the existing function (RLS-safe + perm-aware).
  v_is_admin := public.is_admin();

  -- Pending tasks assigned to the current user.
  SELECT COUNT(*) INTO v_pending_tasks
    FROM public.tasks
   WHERE assigned_to = v_actor
     AND status = 'pending'
     AND deleted_at IS NULL;

  -- Unread notification count for the current user.
  SELECT COUNT(*) INTO v_unread
    FROM public.notifications
   WHERE user_id = v_actor
     AND read_at IS NULL;

  -- 15 most-recent notifications (matches RECENT_LIMIT in the TS service).
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
    'unread_notifications', v_unread,
    'profile', COALESCE(v_profile, '{}'::jsonb) || jsonb_build_object('role', v_role),
    'recent_notifications', v_recent_notifications
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.layout_bootstrap() TO authenticated;
