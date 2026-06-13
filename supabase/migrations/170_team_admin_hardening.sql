-- =============================================================================
-- Migration 170: team-admin hardening (R3-team-2 + R3-team-4)
-- =============================================================================
-- (1) ATOMIC MEMBER DELETE (R3-team-2): deleteMemberAction ran four sequential
--     writes (cases reassign → tasks reassign → associated-advisor cleanup →
--     profile soft-delete) with no transaction — a mid-sequence failure left
--     cases already moved to the acting admin while the member stayed active.
--     admin_delete_member() performs all four in ONE transaction.
--
-- (2) PROTECTED OWNER (R3-team-4): the spec's "manager role is FIXED" had no
--     protection for the owner ACCOUNT — any second admin could demote,
--     deactivate or delete the office owner. profiles.is_protected marks the
--     owner; a trigger refuses end-user writes that demote/deactivate/delete
--     a protected profile (service_role + direct SQL stay allowed for
--     recovery). The bootstrap admin (earliest-created active admin) is
--     marked; adjust with plain SQL if ownership ever moves:
--       UPDATE profiles SET is_protected = false WHERE id = '<old>';
--       UPDATE profiles SET is_protected = true  WHERE id = '<new>';
-- =============================================================================

-- ---- (2a) Protected flag ----------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_protected IS
  'Owner account guard: demote/deactivate/delete are refused for protected profiles (trigger, mig 170).';

-- ---- (2b) Guard trigger -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_protected_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := auth.role();
BEGIN
  -- Only end-user JWT contexts are constrained; service_role (restore) and
  -- direct SQL (migrations / recovery psql, auth.role() IS NULL) pass.
  IF v_jwt_role NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.is_protected THEN
      RAISE EXCEPTION 'this account is protected' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_protected AND (
       NEW.role_id IS DISTINCT FROM OLD.role_id
    OR (OLD.is_active AND NOT NEW.is_active)
    OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
    OR (OLD.is_protected AND NOT NEW.is_protected)
  ) THEN
    RAISE EXCEPTION 'this account is protected' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_protected_profile ON public.profiles;
CREATE TRIGGER trg_guard_protected_profile
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_profile();

-- ---- (2c) Mark the bootstrap owner -------------------------------------------
UPDATE public.profiles SET is_protected = TRUE
 WHERE id = (
   SELECT p.id FROM public.profiles p
   JOIN public.roles r ON r.id = p.role_id
  WHERE r.key = 'admin' AND p.is_active = TRUE AND p.deleted_at IS NULL
  ORDER BY p.created_at ASC
  LIMIT 1
 );

-- ---- (1) Atomic member delete -------------------------------------------------
-- Mirrors deleteMemberAction's four steps in one transaction. Reassigns the
-- member's open work to the ACTING admin (current behavior preserved).
CREATE OR REPLACE FUNCTION public.admin_delete_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'self delete' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND is_protected) THEN
    RAISE EXCEPTION 'this account is protected' USING ERRCODE = '42501';
  END IF;

  -- 1) Open cases → acting admin (closed/archived keep history attribution).
  UPDATE public.cases SET assigned_advisor_id = v_actor, updated_by = v_actor
   WHERE assigned_advisor_id = p_user_id AND deleted_at IS NULL AND is_archived = FALSE;

  -- 2) Pending tasks → acting admin.
  UPDATE public.tasks SET assigned_to = v_actor
   WHERE assigned_to = p_user_id AND status = 'pending' AND deleted_at IS NULL;

  -- 3) Associated-advisor rows (the profile is soft-deleted, so the FK
  --    cascade never fires — clean explicitly).
  DELETE FROM public.case_associated_advisors WHERE advisor_id = p_user_id;

  -- 4) Soft-delete + deactivate the profile.
  UPDATE public.profiles
     SET deleted_at = NOW(), is_active = FALSE
   WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_member(uuid) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (170) ON CONFLICT DO NOTHING;
