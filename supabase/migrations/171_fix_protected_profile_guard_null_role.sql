-- =============================================================================
-- Migration 171: fix guard_protected_profile escape hatch for direct SQL
-- =============================================================================
-- Mig 170 intended service_role (restore) AND direct SQL (migrations / recovery
-- psql) to bypass the protected-profile guard, constraining only end-user JWT
-- contexts. The check was:
--
--     IF v_jwt_role NOT IN ('authenticated', 'anon') THEN RETURN ...; END IF;
--
-- For a raw connection auth.role() IS NULL, and in SQL `NULL NOT IN (...)`
-- evaluates to NULL (not TRUE) — so the early RETURN never fired and the guard
-- blocked direct SQL too. That broke the documented recovery procedure
-- ("adjust with plain SQL if ownership ever moves"). service_role still passed
-- ('service_role' NOT IN (...) = TRUE), so restore + end-user enforcement were
-- unaffected; only the psql recovery hatch was broken.
--
-- Fix: treat a NULL role (direct SQL) the same as service_role — pass through.
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
  -- explicit IS NULL is required: `NULL NOT IN (...)` is NULL, not TRUE.
  IF v_jwt_role IS NULL OR v_jwt_role NOT IN ('authenticated', 'anon') THEN
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

INSERT INTO public.schema_version (version) VALUES (171) ON CONFLICT DO NOTHING;
