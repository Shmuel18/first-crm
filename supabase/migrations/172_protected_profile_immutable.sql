-- =============================================================================
-- Migration 172: close the is_protected self-escalation hole (R3-team-4c)
-- =============================================================================
-- The mig-170 guard only checked transitions WHEN OLD.is_protected was already
-- TRUE. So a regular authenticated user updating their OWN profile with
-- is_protected = TRUE (FALSE -> TRUE) sailed through — the whole
-- `IF OLD.is_protected AND (...)` block was skipped. Verified in prod (rolled
-- back): SELF_PROTECT_SUCCEEDED. Once self-protected, admins could no longer
-- demote / deactivate / delete that user through the app — a privilege
-- escalation + denial-of-management.
--
-- Fix: for end-user JWT contexts (authenticated / anon), is_protected is now
-- FULLY IMMUTABLE — neither FALSE->TRUE (self-protect) nor TRUE->FALSE
-- (unprotect) is allowed — and an INSERT may not be born protected. There is no
-- app surface that legitimately sets is_protected; it is owner/recovery data set
-- only via service_role (restore) or direct SQL (migrations / psql), which keep
-- bypassing (auth.role() service_role, or NULL — see mig 171).
--
-- Also adds a single-owner invariant: at most one protected profile may exist
-- (defence in depth against a trusted-role mistake). Ownership moves must
-- UNSET the old owner BEFORE setting the new one (mig 170's documented order),
-- so the two-protected state never exists even momentarily.
-- =============================================================================

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
  -- direct SQL (migrations / recovery psql, auth.role() IS NULL) pass. The
  -- explicit IS NULL is required: `NULL NOT IN (...)` is NULL, not TRUE (mig 171).
  IF v_jwt_role IS NULL OR v_jwt_role NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- An end-user may never create an already-protected profile.
    IF NEW.is_protected THEN
      RAISE EXCEPTION 'cannot set is_protected' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.is_protected THEN
      RAISE EXCEPTION 'this account is protected' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: is_protected is immutable for end-users in BOTH directions. This is
  -- the R3-team-4c fix — previously only the OLD.is_protected branch ran, so a
  -- self-grant (FALSE->TRUE) was never checked.
  IF NEW.is_protected IS DISTINCT FROM OLD.is_protected THEN
    RAISE EXCEPTION 'cannot change is_protected' USING ERRCODE = '42501';
  END IF;

  -- A protected profile cannot be demoted / deactivated / soft-deleted.
  IF OLD.is_protected AND (
       NEW.role_id IS DISTINCT FROM OLD.role_id
    OR (OLD.is_active AND NOT NEW.is_active)
    OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'this account is protected' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Now guards INSERT too (a profile may not be born protected by an end-user).
DROP TRIGGER IF EXISTS trg_guard_protected_profile ON public.profiles;
CREATE TRIGGER trg_guard_protected_profile
  BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_profile();

-- Single-owner invariant: at most one protected profile.
-- AUDIT-ACK (CONCURRENTLY): public.profiles is the office-staff table (single
-- digits to low double-digit rows). A plain unique index takes a lock measured
-- in microseconds — the CONCURRENTLY rule targets large hot tables (cases,
-- documents, audit_log). The repo has no CONCURRENTLY index precedent, and a
-- transactional index lets this ship atomically with the guard fix above.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_protected_profile
  ON public.profiles (is_protected)
  WHERE is_protected;

INSERT INTO public.schema_version (version) VALUES (172) ON CONFLICT DO NOTHING;
