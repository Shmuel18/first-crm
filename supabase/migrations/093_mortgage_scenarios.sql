-- =============================================================================
-- Migration 093: Mortgage simulator scenarios + tracks
-- =============================================================================
-- Stores advisor-entered mortgage simulations. Calculations are persisted as
-- result_snapshot JSONB so PDFs remain reproducible even if the domain engine
-- changes later. Physical DELETE is intentionally unavailable to app users.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mortgage_scenarios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  primary_borrower_id UUID REFERENCES public.borrowers(id) ON DELETE SET NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('mix', 'comparison', 'scenario', 'capacity', 'early_repayment', 'refinance')),
  title               TEXT NOT NULL,
  mortgage_amount     BIGINT NOT NULL CHECK (mortgage_amount >= 0),
  property_value      BIGINT NOT NULL CHECK (property_value >= 0),
  equity              BIGINT NOT NULL CHECK (equity >= 0),
  term_months         INT NOT NULL CHECK (term_months BETWEEN 1 AND 480),
  property_kind       TEXT NOT NULL CHECK (property_kind IN ('first_home', 'replacement', 'investment')),
  inputs              JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot     JSONB NOT NULL DEFAULT '{}'::jsonb,
  advisor_conclusion  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES public.profiles(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by          UUID REFERENCES public.profiles(id),
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_mortgage_scenarios_case
  ON public.mortgage_scenarios(case_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mortgage_scenarios_owner
  ON public.mortgage_scenarios(created_by, updated_at DESC)
  WHERE deleted_at IS NULL AND case_id IS NULL;

CREATE TRIGGER trg_mortgage_scenarios_updated_at
  BEFORE UPDATE ON public.mortgage_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_mortgage_scenarios
  AFTER INSERT OR UPDATE OR DELETE ON public.mortgage_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

CREATE TABLE IF NOT EXISTS public.scenario_tracks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id    UUID NOT NULL REFERENCES public.mortgage_scenarios(id) ON DELETE CASCADE,
  mix_label      TEXT NOT NULL DEFAULT 'A',
  track_type     TEXT NOT NULL CHECK (track_type IN ('fixed_unlinked', 'fixed_linked', 'prime', 'variable_unlinked', 'variable_linked', 'eligibility')),
  repayment_type TEXT NOT NULL CHECK (repayment_type IN ('spitzer', 'equal_principal', 'balloon')),
  amount         BIGINT NOT NULL CHECK (amount >= 0),
  annual_rate_pct NUMERIC(8, 4) NOT NULL,
  term_months    INT NOT NULL CHECK (term_months BETWEEN 1 AND 480),
  cpi_annual_pct NUMERIC(8, 4),
  grace_months   INT CHECK (grace_months IS NULL OR grace_months >= 0),
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES public.profiles(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by     UUID REFERENCES public.profiles(id),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_scenario_tracks_scenario
  ON public.scenario_tracks(scenario_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_scenario_tracks_updated_at
  BEFORE UPDATE ON public.scenario_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_scenario_tracks
  AFTER INSERT OR UPDATE OR DELETE ON public.scenario_tracks
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

ALTER TABLE public.mortgage_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mortgage_scenarios_select" ON public.mortgage_scenarios;
CREATE POLICY "mortgage_scenarios_select" ON public.mortgage_scenarios
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('view_simulators')
    AND (
      (case_id IS NULL AND created_by = auth.uid())
      OR (case_id IS NOT NULL AND public.can_view_case(case_id))
    )
  );

DROP POLICY IF EXISTS "mortgage_scenarios_insert" ON public.mortgage_scenarios;
CREATE POLICY "mortgage_scenarios_insert" ON public.mortgage_scenarios
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND created_by = auth.uid()
    AND public.has_permission('use_simulators')
    AND (
      case_id IS NULL
      OR (case_id IS NOT NULL AND public.can_view_case(case_id))
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
      OR (case_id IS NOT NULL AND public.can_view_case(case_id))
    )
  )
  WITH CHECK (
    public.has_permission('use_simulators')
    AND (
      (case_id IS NULL AND created_by = auth.uid())
      OR (case_id IS NOT NULL AND public.can_view_case(case_id))
    )
  );

DROP POLICY IF EXISTS "scenario_tracks_select" ON public.scenario_tracks;
CREATE POLICY "scenario_tracks_select" ON public.scenario_tracks
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.mortgage_scenarios s
       WHERE s.id = scenario_tracks.scenario_id
         AND s.deleted_at IS NULL
         AND public.has_permission('view_simulators')
         AND (
           (s.case_id IS NULL AND s.created_by = auth.uid())
           OR (s.case_id IS NOT NULL AND public.can_view_case(s.case_id))
         )
    )
  );

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
           OR (s.case_id IS NOT NULL AND public.can_view_case(s.case_id))
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
           OR (s.case_id IS NOT NULL AND public.can_view_case(s.case_id))
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
           OR (s.case_id IS NOT NULL AND public.can_view_case(s.case_id))
         )
    )
  );

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
         OR (s.case_id IS NOT NULL AND public.can_view_case(s.case_id))
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
