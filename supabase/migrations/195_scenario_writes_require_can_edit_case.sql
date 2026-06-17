-- =============================================================================
-- Migration 195: case-scoped scenario WRITES require can_edit_case (Theme I / SIM-PERSIST-1)
-- =============================================================================
-- The mortgage-scenario write paths (RLS INSERT/UPDATE on mortgage_scenarios +
-- scenario_tracks, the save_mortgage_scenario RPC, and soft_delete_scenario) all
-- authorized a case-scoped scenario on public.can_view_case — a READ permission.
-- So a user with use_simulators + view_all_cases but NO edit rights (e.g. a
-- secretary on an unassigned case) could CREATE / EDIT / DELETE scenarios inside
-- any case they can only view (R15 SIM-PERSIST-1). Per the base invariant,
-- case-scoped writes must canonicalize on public.can_edit_case.
--
-- This recreates only the WRITE paths, swapping can_view_case -> can_edit_case on
-- the case-scoped branch. UNCHANGED on purpose:
--   * the case-less branch  (case_id IS NULL AND created_by = actor) — a user's
--     own standalone scratch scenario stays editable by its owner.
--   * the SELECT policies (mortgage_scenarios_select / scenario_tracks_select) —
--     viewing a case's scenarios still only needs can_view_case.
-- Idempotent (DROP POLICY IF EXISTS + CREATE / CREATE OR REPLACE). Deps: 093, 097, 147.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. mortgage_scenarios INSERT / UPDATE (was mig 093)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "mortgage_scenarios_insert" ON public.mortgage_scenarios;
CREATE POLICY "mortgage_scenarios_insert" ON public.mortgage_scenarios
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND created_by = auth.uid()
    AND public.has_permission('use_simulators')
    AND (
      case_id IS NULL
      OR (case_id IS NOT NULL AND public.can_edit_case(case_id))
    )
  );

DROP POLICY IF EXISTS "mortgage_scenarios_update" ON public.mortgage_scenarios;
CREATE POLICY "mortgage_scenarios_update" ON public.mortgage_scenarios
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('use_simulators')
    AND (
      (case_id IS NULL AND created_by = auth.uid())
      OR (case_id IS NOT NULL AND public.can_edit_case(case_id))
    )
  )
  WITH CHECK (
    public.has_permission('use_simulators')
    AND (
      (case_id IS NULL AND created_by = auth.uid())
      OR (case_id IS NOT NULL AND public.can_edit_case(case_id))
    )
  );

-- -----------------------------------------------------------------------------
-- 2. scenario_tracks INSERT / UPDATE (was mig 093)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "scenario_tracks_insert" ON public.scenario_tracks;
CREATE POLICY "scenario_tracks_insert" ON public.scenario_tracks
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.mortgage_scenarios s
       WHERE s.id = scenario_tracks.scenario_id
         AND s.deleted_at IS NULL
         AND public.has_permission('use_simulators')
         AND (
           (s.case_id IS NULL AND s.created_by = auth.uid())
           OR (s.case_id IS NOT NULL AND public.can_edit_case(s.case_id))
         )
    )
  );

DROP POLICY IF EXISTS "scenario_tracks_update" ON public.scenario_tracks;
CREATE POLICY "scenario_tracks_update" ON public.scenario_tracks
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.mortgage_scenarios s
       WHERE s.id = scenario_tracks.scenario_id
         AND s.deleted_at IS NULL
         AND public.has_permission('use_simulators')
         AND (
           (s.case_id IS NULL AND s.created_by = auth.uid())
           OR (s.case_id IS NOT NULL AND public.can_edit_case(s.case_id))
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mortgage_scenarios s
       WHERE s.id = scenario_tracks.scenario_id
         AND s.deleted_at IS NULL
         AND public.has_permission('use_simulators')
         AND (
           (s.case_id IS NULL AND s.created_by = auth.uid())
           OR (s.case_id IS NOT NULL AND public.can_edit_case(s.case_id))
         )
    )
  );

-- -----------------------------------------------------------------------------
-- 3. soft_delete_scenario RPC (was mig 093)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_scenario(p_scenario_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_updated BOOLEAN;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.mortgage_scenarios s
     WHERE s.id = p_scenario_id
       AND s.deleted_at IS NULL
       AND public.has_permission('use_simulators')
       AND (
         (s.case_id IS NULL AND s.created_by = v_actor)
         OR (s.case_id IS NOT NULL AND public.can_edit_case(s.case_id))
       )
  ) THEN
    RAISE EXCEPTION 'not authorized for this scenario' USING ERRCODE = '42501';
  END IF;

  UPDATE public.mortgage_scenarios
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE id = p_scenario_id AND deleted_at IS NULL;
  v_updated := FOUND;

  UPDATE public.scenario_tracks
     SET deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
   WHERE scenario_id = p_scenario_id AND deleted_at IS NULL;

  RETURN v_updated;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_scenario(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_scenario(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. save_mortgage_scenario RPC — case-scoped EDIT + INSERT require can_edit_case
--    (was mig 097; case-less owner branch + all other logic unchanged)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_mortgage_scenario(p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_case_id UUID := NULLIF(p_payload->>'caseId', '')::UUID;
  v_borrower_id UUID := NULLIF(p_payload->>'primaryBorrowerId', '')::UUID;
  v_scenario_id UUID := NULLIF(p_payload->>'scenarioId', '')::UUID;
  v_track_count INT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid payload' USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_permission('use_simulators') THEN
    RAISE EXCEPTION 'missing use_simulators permission' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_payload->'tracks') <> 'array' THEN
    RAISE EXCEPTION 'tracks must be an array' USING ERRCODE = '22023';
  END IF;

  v_track_count := jsonb_array_length(p_payload->'tracks');
  IF v_track_count < 1 OR v_track_count > 12 THEN
    RAISE EXCEPTION 'invalid track count' USING ERRCODE = '22023';
  END IF;

  -- EDIT path: authorize against the EXISTING stored row.
  IF v_scenario_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.mortgage_scenarios s
       WHERE s.id = v_scenario_id
         AND s.deleted_at IS NULL
         AND (
           (s.case_id IS NULL AND s.created_by = v_actor)
           OR (s.case_id IS NOT NULL AND public.can_edit_case(s.case_id))
         )
    ) THEN
      RAISE EXCEPTION 'not authorized for this scenario' USING ERRCODE = '42501';
    END IF;

    UPDATE public.mortgage_scenarios SET
      kind = p_payload->>'kind',
      title = p_payload->>'title',
      mortgage_amount = (p_payload->>'mortgageAmount')::BIGINT,
      property_value = (p_payload->>'propertyValue')::BIGINT,
      equity = (p_payload->>'equity')::BIGINT,
      term_months = (p_payload->>'termMonths')::INT,
      property_kind = p_payload->>'propertyKind',
      inputs = p_payload->'inputs',
      result_snapshot = p_payload->'resultSnapshot',
      advisor_conclusion = NULLIF(p_payload->>'advisorConclusion', ''),
      updated_by = v_actor
    WHERE id = v_scenario_id AND deleted_at IS NULL;

    DELETE FROM public.scenario_tracks WHERE scenario_id = v_scenario_id;

    INSERT INTO public.scenario_tracks (
      scenario_id, mix_label, track_type, repayment_type, amount,
      annual_rate_pct, term_months, cpi_annual_pct, grace_months, sort_order,
      created_by, updated_by
    )
    SELECT
      v_scenario_id,
      COALESCE(track->>'mixLabel', 'A'),
      track->>'trackType',
      track->>'repaymentType',
      (track->>'amount')::BIGINT,
      (track->>'annualRatePct')::NUMERIC,
      (track->>'termMonths')::INT,
      NULLIF(track->>'cpiAnnualPct', '')::NUMERIC,
      NULLIF(track->>'graceMonths', '')::INT,
      COALESCE(NULLIF(track->>'sortOrder', '')::INT, ordinality::INT - 1),
      v_actor,
      v_actor
    FROM jsonb_array_elements(p_payload->'tracks') WITH ORDINALITY AS rows(track, ordinality);

    RETURN v_scenario_id;
  END IF;

  -- INSERT path (new scenario): authorize the placement from the payload.
  IF v_case_id IS NOT NULL AND NOT public.can_edit_case(v_case_id) THEN
    RAISE EXCEPTION 'not authorized for case scenario' USING ERRCODE = '42501';
  END IF;

  IF v_borrower_id IS NOT NULL AND (
    v_case_id IS NULL
    OR NOT EXISTS (
      SELECT 1
        FROM public.case_borrowers cb
       WHERE cb.case_id = v_case_id
         AND cb.borrower_id = v_borrower_id
    )
  ) THEN
    RAISE EXCEPTION 'borrower is not linked to scenario case' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.mortgage_scenarios (
    case_id, primary_borrower_id, kind, title, mortgage_amount, property_value,
    equity, term_months, property_kind, inputs, result_snapshot,
    advisor_conclusion, created_by, updated_by
  ) VALUES (
    v_case_id,
    v_borrower_id,
    p_payload->>'kind',
    p_payload->>'title',
    (p_payload->>'mortgageAmount')::BIGINT,
    (p_payload->>'propertyValue')::BIGINT,
    (p_payload->>'equity')::BIGINT,
    (p_payload->>'termMonths')::INT,
    p_payload->>'propertyKind',
    p_payload->'inputs',
    p_payload->'resultSnapshot',
    NULLIF(p_payload->>'advisorConclusion', ''),
    v_actor,
    v_actor
  )
  RETURNING id INTO v_scenario_id;

  INSERT INTO public.scenario_tracks (
    scenario_id, mix_label, track_type, repayment_type, amount,
    annual_rate_pct, term_months, cpi_annual_pct, grace_months, sort_order,
    created_by, updated_by
  )
  SELECT
    v_scenario_id,
    COALESCE(track->>'mixLabel', 'A'),
    track->>'trackType',
    track->>'repaymentType',
    (track->>'amount')::BIGINT,
    (track->>'annualRatePct')::NUMERIC,
    (track->>'termMonths')::INT,
    NULLIF(track->>'cpiAnnualPct', '')::NUMERIC,
    NULLIF(track->>'graceMonths', '')::INT,
    COALESCE(NULLIF(track->>'sortOrder', '')::INT, ordinality::INT - 1),
    v_actor,
    v_actor
  FROM jsonb_array_elements(p_payload->'tracks') WITH ORDINALITY AS rows(track, ordinality);

  RETURN v_scenario_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_mortgage_scenario(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_mortgage_scenario(JSONB) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (195) ON CONFLICT DO NOTHING;
