-- =============================================================================
-- Migration 180: case_properties.created_by is immutable (R5-advisors-1 follow-up)
-- =============================================================================
-- Migration 179 pinned created_by/updated_by on INSERT via WITH CHECK, but RLS
-- WITH CHECK cannot reference OLD, so a direct PostgREST UPDATE could still
-- re-write created_by to forge attribution on an existing row. This trigger makes
-- created_by write-once: any end-user UPDATE that changes it is refused. Only
-- end-user JWT contexts (authenticated/anon) are constrained; service_role +
-- direct SQL (restore, migrations) pass. updated_by stays mutable (the editor
-- stamps it; mig 179 WITH CHECK pins it to auth.uid()).
--
-- Idempotent. Dependencies: 156 (case_properties), 179 (anti-forgery WITH CHECK),
-- 143 (schema_version).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_case_property_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.role();
BEGIN
  IF v_role IN ('authenticated', 'anon')
     AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'case_properties.created_by is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_case_property_created_by ON public.case_properties;
CREATE TRIGGER trg_guard_case_property_created_by
  BEFORE UPDATE ON public.case_properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_case_property_created_by();

INSERT INTO public.schema_version (version) VALUES (180) ON CONFLICT DO NOTHING;
