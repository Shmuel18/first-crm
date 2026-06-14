-- =============================================================================
-- Migration 178: enforce change_case_status / assign_case_to_user at the DB
--                (R5-update-fee-1)
-- =============================================================================
-- The granular permissions change_case_status and assign_case_to_user are
-- admin-configurable in the roles editor, but only quickUpdateCaseFieldAction
-- enforced them — updateCaseFieldAction, updateCaseAction, and any direct
-- PostgREST UPDATE could change cases.status_id / assigned_advisor_id with only
-- the generic edit gate, defeating two switches the manager believes are
-- effective (segregation of duties). RLS checks neither key.
--
-- Fix: a BEFORE UPDATE trigger enforces the granular keys for EVERY end-user
-- write path, and ONLY when the value actually changes (IS DISTINCT FROM), so a
-- routine save that doesn't touch status/advisor needs no extra permission.
-- service_role / direct SQL (restore, migrations, the SECURITY DEFINER lifecycle
-- RPCs that mutate other columns) pass. App-layer fail-fast gates are added too,
-- but this is the load-bearing enforcement.
--
-- Idempotent. Dependencies: 002 (has_permission + the two keys), 006 (cases),
-- 143 (schema_version).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_case_trusted_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.role();
BEGIN
  -- Only end-user JWT contexts are constrained; service_role + direct SQL pass.
  IF v_role IS NULL OR v_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.status_id IS DISTINCT FROM OLD.status_id
     AND NOT public.has_permission('change_case_status') THEN
    RAISE EXCEPTION 'missing change_case_status permission' USING ERRCODE = '42501';
  END IF;

  IF NEW.assigned_advisor_id IS DISTINCT FROM OLD.assigned_advisor_id
     AND NOT public.has_permission('assign_case_to_user') THEN
    RAISE EXCEPTION 'missing assign_case_to_user permission' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_case_trusted_columns ON public.cases;
CREATE TRIGGER trg_guard_case_trusted_columns
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.guard_case_trusted_columns();

INSERT INTO public.schema_version (version) VALUES (178) ON CONFLICT DO NOTHING;
