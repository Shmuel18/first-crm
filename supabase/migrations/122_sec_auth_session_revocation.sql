-- =============================================================================
-- Migration 122: SEC-AUTH-1 — session revocation on deactivate / delete
-- =============================================================================
-- Deactivating or soft-deleting a team member (setMemberActiveAction /
-- deleteMemberAction → profiles.is_active=false [+ deleted_at]) previously left
-- their browser session fully valid:
--   * the Next middleware only checked auth.getUser() (never is_active), and
--   * layout_bootstrap (mig 066) returned the profile without an is_active gate.
-- With refresh-token rotation on (config.toml), the session renewed itself
-- indefinitely, so a removed advisor kept app access + read until they happened
-- to sign out. RLS already blocked their *writes* (has_permission / is_admin
-- both require is_active=TRUE, mig 002), but not app access or reads.
--
-- Two helpers close the gap:
--   current_user_active()  — fail-closed boolean the middleware checks on every
--                            authenticated protected request, to bounce a
--                            now-inactive session immediately.
--   revoke_user_sessions() — admin-only hard revoke of a user's sessions so the
--                            session can't be renewed or replayed against the
--                            REST API after the access token expires.
-- =============================================================================

-- 1) Per-request gate. SECURITY DEFINER so the answer never depends on the
--    profiles RLS read policy. Fail-closed: a missing row, is_active=false, or
--    a soft-deleted row all yield FALSE. No params, returns only whether the
--    CALLER is active, so it leaks nothing.
CREATE OR REPLACE FUNCTION public.current_user_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.is_active = TRUE
       AND p.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_active() TO authenticated;

-- 2) Hard session revoke. SECURITY DEFINER to reach the auth schema; guarded so
--    only an admin can call it. Deleting auth.sessions cascades to the matching
--    auth.refresh_tokens (FK ON DELETE CASCADE), so the session cannot be
--    refreshed. Self-revoke is allowed at the SQL level but the calling actions
--    block acting on your own id (avoids an admin nuking their own session).
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'revoke_user_sessions: no auth context' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'revoke_user_sessions: admin only' USING ERRCODE = '42501';
  END IF;

  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_user_sessions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(UUID) TO authenticated;
