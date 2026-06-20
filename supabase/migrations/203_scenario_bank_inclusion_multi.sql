-- =============================================================================
-- Migration 203: allow MULTIPLE mixes per case in the bank PDF
-- =============================================================================
-- Migration 202 modelled "the primary mix" — exactly one per case (partial unique
-- index) — and the bank PDF embedded that one. Product change: an advisor may want
-- to present several mix options to the bank, so the flag becomes a multi-select
-- "include in the bank document". The `is_primary` column is reused as-is (now read
-- as "included in bank PDF"; renaming it would churn types/RPC/UI for no behavioural
-- gain). Two changes:
--   1. Drop the single-primary unique index so several rows per case may be flagged.
--   2. set_primary_scenario no longer clears siblings — it just (un)sets the one row.
-- Authorization (can_edit_case) is unchanged. Idempotent. Deps: 202.
-- =============================================================================

DROP INDEX IF EXISTS public.uq_mortgage_scenarios_primary_per_case;

CREATE OR REPLACE FUNCTION public.set_primary_scenario(
  p_scenario_id UUID,
  p_is_primary  BOOLEAN DEFAULT true
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor   UUID := auth.uid();
  v_case_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  -- The row must be live, case-scoped, and editable by the caller. A standalone or
  -- not-visible scenario yields NULL -> fail closed.
  SELECT s.case_id INTO v_case_id
    FROM public.mortgage_scenarios s
   WHERE s.id = p_scenario_id
     AND s.deleted_at IS NULL
     AND s.case_id IS NOT NULL
     AND public.has_permission('use_simulators')
     AND public.can_edit_case(s.case_id);

  IF v_case_id IS NULL THEN
    RAISE EXCEPTION 'not authorized for this scenario' USING ERRCODE = '42501';
  END IF;

  -- Multi-select: just (un)flag this one. Siblings are independent now.
  UPDATE public.mortgage_scenarios
     SET is_primary = p_is_primary, updated_by = v_actor
   WHERE id = p_scenario_id AND deleted_at IS NULL;

  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_primary_scenario(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_primary_scenario(UUID, BOOLEAN) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (203) ON CONFLICT DO NOTHING;
