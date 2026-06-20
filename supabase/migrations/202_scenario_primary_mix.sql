-- =============================================================================
-- Migration 202: mark one mortgage scenario per case as the "primary" mix
-- =============================================================================
-- The bank-submission PDF embeds the case's proposed mortgage mix (tracks +
-- payment range). A case can hold several saved mixes, so the advisor designates
-- ONE as primary; the PDF reads that one (falling back to the most-recently-
-- updated mix when none is marked — handled in the data layer).
--
-- Model: a boolean is_primary on mortgage_scenarios, guarded by a partial UNIQUE
-- index so at most one live primary may exist per case. Toggling is done through
-- the SECURITY DEFINER RPC set_primary_scenario, which clears siblings then sets
-- the target in one statement-ordered transaction (satisfying the unique index)
-- and authorizes on public.can_edit_case — the same write gate the rest of the
-- scenario write paths canonicalize on (mig 195). Standalone scenarios
-- (case_id IS NULL) cannot be primary: "primary FOR a case" is meaningless
-- without a case, and the index/RPC both require case_id IS NOT NULL.
--
-- Idempotent. Deps: 093 (table), 195 (can_edit_case write gate).
-- =============================================================================

ALTER TABLE public.mortgage_scenarios
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- At most one live primary per case. Partial predicate matches zero rows today
-- (no scenario is primary yet) so the build is effectively free; the table is
-- small (a handful of mixes per case) so a plain index needs no CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mortgage_scenarios_primary_per_case
  ON public.mortgage_scenarios(case_id)
  WHERE is_primary AND case_id IS NOT NULL AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- set_primary_scenario(scenario_id, is_primary) — atomically (un)mark a case
-- scenario as the primary mix. Clears any sibling primary first so the unique
-- index never trips. Authorized on can_edit_case, like every scenario write.
-- -----------------------------------------------------------------------------
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

  -- Resolve the scenario's case and authorize the write in one shot: the row
  -- must be live, case-scoped, and editable by the caller. A standalone or
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

  IF p_is_primary THEN
    -- Clear the current primary (if any) BEFORE setting the new one so the
    -- partial unique index is satisfied at statement boundaries.
    UPDATE public.mortgage_scenarios
       SET is_primary = false, updated_by = v_actor
     WHERE case_id = v_case_id
       AND id <> p_scenario_id
       AND is_primary
       AND deleted_at IS NULL;

    UPDATE public.mortgage_scenarios
       SET is_primary = true, updated_by = v_actor
     WHERE id = p_scenario_id AND deleted_at IS NULL;
  ELSE
    UPDATE public.mortgage_scenarios
       SET is_primary = false, updated_by = v_actor
     WHERE id = p_scenario_id AND deleted_at IS NULL;
  END IF;

  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_primary_scenario(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_primary_scenario(UUID, BOOLEAN) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (202) ON CONFLICT DO NOTHING;
