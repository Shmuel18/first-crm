-- =============================================================================
-- Migration 156: case_properties — additional properties per case (Option A)
-- =============================================================================
-- A case sometimes involves several properties for one client. The PRIMARY
-- property stays on cases.* (property_value / requested_mortgage_amount / city /
-- case_type_*) and keeps driving the bank PDF, LTV calc and simulator UNCHANGED.
-- This table holds the ADDITIONAL properties — recorded + displayed in the
-- property block (add / edit / remove), informational only (no PDF/calc wiring).
--
-- Mirrors the case_expenses child-table pattern (migration 081): can_view_case
-- for SELECT, edit_any/edit_own + assigned-advisor scope for INSERT/UPDATE,
-- soft-delete via a SECURITY DEFINER RPC (no physical DELETE policy).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.case_properties (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                   UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  case_type_primary_id      UUID REFERENCES public.case_types(id),
  case_type_other_text      TEXT,
  city                      TEXT,
  property_value            NUMERIC(15, 2),
  requested_mortgage_amount NUMERIC(15, 2),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                UUID REFERENCES public.profiles(id),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                UUID REFERENCES public.profiles(id),
  deleted_at                TIMESTAMPTZ,
  deleted_by                UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_case_properties_case
  ON public.case_properties(case_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_case_properties_updated_at
  BEFORE UPDATE ON public.case_properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_properties ENABLE ROW LEVEL SECURITY;

-- SELECT — anyone who can view the parent case AND the row isn't soft-deleted.
DROP POLICY IF EXISTS "case_properties_select" ON public.case_properties;
CREATE POLICY "case_properties_select" ON public.case_properties
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_properties.case_id
         AND c.deleted_at IS NULL
         AND public.can_view_case(c.id)
    )
  );

-- INSERT — anyone who can edit the parent case.
DROP POLICY IF EXISTS "case_properties_insert" ON public.case_properties;
CREATE POLICY "case_properties_insert" ON public.case_properties
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_properties.case_id
         AND c.deleted_at IS NULL
         AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  );

-- UPDATE — both sides check edit permission + case ownership.
DROP POLICY IF EXISTS "case_properties_update" ON public.case_properties;
CREATE POLICY "case_properties_update" ON public.case_properties
  FOR UPDATE TO authenticated
  USING (
    (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_properties.case_id
         AND c.deleted_at IS NULL
         AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  )
  WITH CHECK (
    (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_properties.case_id
         AND c.deleted_at IS NULL
         AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  );

-- No DELETE policy — soft-delete only via the RPC.
CREATE OR REPLACE FUNCTION public.soft_delete_case_property(
  p_case_id     UUID,
  p_property_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.case_properties p
      JOIN public.cases c ON c.id = p.case_id
     WHERE p.id = p_property_id
       AND p.case_id = p_case_id
       AND p.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND (
         public.has_permission('edit_any_case')
         OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = v_actor)
       )
  ) THEN
    RAISE EXCEPTION 'not authorized for this case property' USING ERRCODE = '42501';
  END IF;

  UPDATE public.case_properties
     SET deleted_at = now(),
         deleted_by = v_actor,
         updated_by = v_actor
   WHERE id = p_property_id
     AND case_id = p_case_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_case_property(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_case_property(UUID, UUID) TO authenticated;

COMMENT ON TABLE public.case_properties IS
  'Additional properties a case involves beyond the primary property on cases.* — informational, does not feed PDF/LTV/simulator. See migration 156.';

INSERT INTO public.schema_version (version) VALUES (156) ON CONFLICT DO NOTHING;
