-- =============================================================================
-- Migration 176: default responsible advisor on case creation (R5-create-draft-1)
-- =============================================================================
-- Both create_case_draft (mig 142) and convert_lead_to_case (mig 152) INSERT a
-- case with assigned_advisor_id = NULL. Under RLS (mig 147) a creator whose role
-- has view_own_cases but NOT view_all_cases (e.g. junior_advisor) then cannot
-- SELECT or UPDATE the case they just made — it 404s immediately and is editable
-- only by managers (silent orphaning + broken primary new-case/convert workflow).
--
-- Rule (per the office model): if the creator can see ALL cases (manager /
-- secretary), leave the case UNASSIGNED so it lands in the manager's
-- distribution queue (the documented design). Otherwise assign it to the creator
-- so they own what they just created.
--
-- Implemented as a BEFORE INSERT trigger so it applies to EVERY case-create path
-- (both RPCs + any future one) from a single source of truth, without rewriting
-- the two large SECURITY DEFINER bodies. Only end-user contexts with a real
-- auth.uid() are affected; service_role / direct SQL (restore, migrations) pass.
-- An explicit assigned_advisor_id on INSERT is respected (only NULL is defaulted).
--
-- Idempotent. Dependencies: 006 (cases), 002 (has_permission), 143 (schema_version).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_case_default_advisor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.assigned_advisor_id IS NULL
     AND NOT public.has_permission('view_all_cases') THEN
    NEW.assigned_advisor_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_case_default_advisor ON public.cases;
CREATE TRIGGER trg_set_case_default_advisor
  BEFORE INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_case_default_advisor();

INSERT INTO public.schema_version (version) VALUES (176) ON CONFLICT DO NOTHING;
