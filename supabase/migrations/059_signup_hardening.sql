-- =============================================================================
-- Migration 059: Defense-in-depth — handle_new_user requires invited_by metadata
-- =============================================================================
-- handle_new_user (migration 002) is an unconditional AFTER INSERT ON auth.users
-- trigger that grants every newly-created auth user a `junior_advisor` profile.
-- If self-signup is enabled at the Supabase project level (default: ON in a
-- fresh project), anyone with the anon key can POST /auth/v1/signup and end
-- up with a junior_advisor session — bypassing the magic-link invite flow
-- entirely.
--
-- The CORRECT fix is to disable self-signup in the Supabase dashboard
-- (Authentication → Providers → Email → "Allow new users to sign up" = OFF).
-- That's an operator action and lives in the handoff doc.
--
-- THIS migration is the belt-and-suspenders DB-layer guard: refuse to create
-- a profile unless the auth user was created via the admin invite path. The
-- invite path passes `data: { invited_by: <admin_uid> }` (set by the team
-- invite action); a raw signUp omits it.
--
-- Effect with both layers:
--   - Self-signup OFF + this guard = belt-and-suspenders.
--   - Self-signup accidentally re-enabled = guard still blocks the profile
--     creation. The auth user exists but has no profile, so RLS denies them
--     everything (every policy checks profiles.role_id). They get an
--     unfilled-out account that's effectively locked out.
--
-- Existing users (created before this migration) are unaffected — the
-- guard only fires on new INSERTs to auth.users.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_by TEXT;
  v_default_role_id UUID;
BEGIN
  -- raw_user_meta_data is whatever was passed in `data:` when the user was
  -- created. The admin invite flow (inviteMemberAction → admin.generateLink)
  -- sets `invited_by` to the admin's UUID. A direct supabase.auth.signUp
  -- from the anon key cannot set this server-side field unless the operator
  -- explicitly allowed it.
  v_invited_by := NEW.raw_user_meta_data->>'invited_by';

  IF v_invited_by IS NULL OR length(v_invited_by) = 0 THEN
    -- No invited_by — refuse. The auth user already exists (we're in an
    -- AFTER trigger), but skipping the profile INSERT means RLS denies
    -- everything for this user. Defensible: a misconfigured self-signup
    -- doesn't grant database access.
    RAISE LOG 'handle_new_user: refusing profile creation for % (no invited_by metadata; self-signup may be enabled)', NEW.id;
    RETURN NEW;
  END IF;

  SELECT id INTO v_default_role_id
    FROM public.roles
   WHERE key = 'junior_advisor'
   LIMIT 1;

  INSERT INTO public.profiles (id, email, role_id, language, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    v_default_role_id,
    'he',
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
