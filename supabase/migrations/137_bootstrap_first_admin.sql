-- =============================================================================
-- Migration 137: bootstrap_first_admin — one-time first-manager provisioning
-- =============================================================================
-- GAP-Bootstrap. A from-scratch database can't reach a working manager login:
--   * handle_new_user (migration 059) refuses to create a profile unless the
--     auth user carries raw_user_meta_data.invited_by;
--   * only the in-app team-invite flow sets invited_by;
--   * that flow requires an EXISTING admin (inviteMemberAction checks is_admin).
-- → chicken-and-egg: no admin can ever be created. This also blocks
--   disaster-recovery (restore into a clean Supabase project).
--
-- Fix: a SECURITY DEFINER function the OPERATOR runs once from the SQL Editor.
-- It is self-disabling — it only acts while no active admin exists — so it
-- cannot be abused to mint admins after setup. It is NOT granted to the app
-- (REVOKE FROM PUBLIC); only the postgres/service role (SQL Editor) can call it.
--
-- Procedure (see docs/BOOTSTRAP.md):
--   1. Supabase Dashboard → Authentication → Add user (email + password).
--   2. SQL Editor:  SELECT public.bootstrap_first_admin('manager@example.com');
--   3. Log in, then invite everyone else from /team.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_email TEXT := lower(btrim(p_email));
  v_user_id UUID;
  v_admin_role_id UUID;
BEGIN
  -- Self-disabling guard: refuse the moment an active admin exists, so this
  -- can never be used to escalate privileges after the office is set up.
  IF EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
     WHERE r.key = 'admin'
       AND p.is_active = TRUE
       AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'bootstrap_first_admin is disabled: an active admin already exists'
      USING HINT = 'Add further members via the in-app team invite (/team).';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'no auth user with email %', v_email
      USING HINT = 'Create the user first: Supabase Dashboard -> Authentication -> Add user.';
  END IF;

  SELECT id INTO v_admin_role_id FROM public.roles WHERE key = 'admin' LIMIT 1;
  IF v_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'admin role is missing — run the lookups seed (migration 004)';
  END IF;

  -- Create or promote the profile. handle_new_user (059) may have skipped it
  -- (no invited_by on a dashboard-created user), so ON CONFLICT upgrades
  -- whatever exists. Runs as owner, bypassing the invited_by guard.
  INSERT INTO public.profiles (id, email, role_id, language, is_active)
  VALUES (v_user_id, v_email, v_admin_role_id, 'he', TRUE)
  ON CONFLICT (id) DO UPDATE
    SET role_id = EXCLUDED.role_id,
        is_active = TRUE,
        deleted_at = NULL;

  RETURN v_user_id;
END;
$fn$;

-- Operator-only: callable from the SQL Editor (postgres/service_role), never
-- from the app. authenticated/anon must not reach it even in the bootstrap
-- window (there is no profile yet, but defense in depth).
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(TEXT) FROM PUBLIC;
