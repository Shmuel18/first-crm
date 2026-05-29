-- =============================================================================
-- Migration 096: Atomic save RPC for mortgage simulator scenarios
-- =============================================================================

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
  v_scenario_id UUID;
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

  IF v_case_id IS NOT NULL AND NOT public.can_view_case(v_case_id) THEN
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

  IF jsonb_typeof(p_payload->'tracks') <> 'array' THEN
    RAISE EXCEPTION 'tracks must be an array' USING ERRCODE = '22023';
  END IF;

  v_track_count := jsonb_array_length(p_payload->'tracks');
  IF v_track_count < 1 OR v_track_count > 12 THEN
    RAISE EXCEPTION 'invalid track count' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.mortgage_scenarios (
    case_id,
    primary_borrower_id,
    kind,
    title,
    mortgage_amount,
    property_value,
    equity,
    term_months,
    property_kind,
    inputs,
    result_snapshot,
    advisor_conclusion,
    created_by,
    updated_by
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
    scenario_id,
    mix_label,
    track_type,
    repayment_type,
    amount,
    annual_rate_pct,
    term_months,
    cpi_annual_pct,
    grace_months,
    sort_order,
    created_by,
    updated_by
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
