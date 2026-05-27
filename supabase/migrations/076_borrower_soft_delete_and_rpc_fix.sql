-- =============================================================================
-- Migration 076: borrower child soft-delete + update_borrower_in_case fix
-- =============================================================================
-- Production hardening:
--   1. borrower_incomes / borrower_obligations now follow the CRM-wide
--      retention rule: user deletes are soft deletes via deleted_at/deleted_by.
--   2. Physical DELETE is removed at the RLS layer for these financial tables.
--   3. update_borrower_in_case is replaced with an implementation that does
--      not reference the UPDATE target alias inside jsonb_populate_record().
-- =============================================================================

ALTER TABLE public.borrower_incomes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.borrower_obligations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_borrower_incomes_active_borrower
  ON public.borrower_incomes(borrower_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_borrower_obligations_active_borrower
  ON public.borrower_obligations(borrower_id)
  WHERE deleted_at IS NULL;

-- SELECT policies hide soft-deleted financial rows.
DROP POLICY IF EXISTS "incomes_select" ON public.borrower_incomes;
CREATE POLICY "incomes_select" ON public.borrower_incomes
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('view_case_incomes')
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      WHERE b.id = borrower_incomes.borrower_id
        AND b.deleted_at IS NULL
        AND public.can_view_case(cb.case_id)
    )
  );

DROP POLICY IF EXISTS "obligations_select" ON public.borrower_obligations;
CREATE POLICY "obligations_select" ON public.borrower_obligations
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('view_case_obligations')
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      WHERE b.id = borrower_obligations.borrower_id
        AND b.deleted_at IS NULL
        AND public.can_view_case(cb.case_id)
    )
  );

-- Replace broad FOR ALL policies. INSERT/UPDATE are allowed only when the
-- borrower belongs to a case the caller can edit; DELETE is intentionally absent.
DROP POLICY IF EXISTS "incomes_modify" ON public.borrower_incomes;
DROP POLICY IF EXISTS "incomes_insert" ON public.borrower_incomes;
DROP POLICY IF EXISTS "incomes_update" ON public.borrower_incomes;
CREATE POLICY "incomes_insert" ON public.borrower_incomes
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      JOIN public.cases c ON c.id = cb.case_id
      WHERE b.id = borrower_incomes.borrower_id
        AND b.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  );

CREATE POLICY "incomes_update" ON public.borrower_incomes
  FOR UPDATE TO authenticated
  USING (
    (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      JOIN public.cases c ON c.id = cb.case_id
      WHERE b.id = borrower_incomes.borrower_id
        AND b.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  )
  WITH CHECK (
    (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      JOIN public.cases c ON c.id = cb.case_id
      WHERE b.id = borrower_incomes.borrower_id
        AND b.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "obligations_modify" ON public.borrower_obligations;
DROP POLICY IF EXISTS "obligations_insert" ON public.borrower_obligations;
DROP POLICY IF EXISTS "obligations_update" ON public.borrower_obligations;
CREATE POLICY "obligations_insert" ON public.borrower_obligations
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      JOIN public.cases c ON c.id = cb.case_id
      WHERE b.id = borrower_obligations.borrower_id
        AND b.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  );

CREATE POLICY "obligations_update" ON public.borrower_obligations
  FOR UPDATE TO authenticated
  USING (
    (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      JOIN public.cases c ON c.id = cb.case_id
      WHERE b.id = borrower_obligations.borrower_id
        AND b.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  )
  WITH CHECK (
    (public.has_permission('edit_any_case') OR public.has_permission('edit_own_case'))
    AND EXISTS (
      SELECT 1
      FROM public.borrowers b
      JOIN public.case_borrowers cb ON cb.borrower_id = b.id
      JOIN public.cases c ON c.id = cb.case_id
      WHERE b.id = borrower_obligations.borrower_id
        AND b.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND (public.has_permission('edit_any_case') OR c.assigned_advisor_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.update_borrower_in_case(
  p_case_id UUID,
  p_borrower_id UUID,
  p_patch JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_safe_patch JSONB;
  v_current public.borrowers%ROWTYPE;
  v_next public.borrowers%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cases
     WHERE id = p_case_id AND deleted_at IS NULL
       AND (assigned_advisor_id = v_actor OR public.has_permission('edit_any_case'))
  ) THEN
    RAISE EXCEPTION 'not authorized for this case' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.case_borrowers
     WHERE case_id = p_case_id AND borrower_id = p_borrower_id
  ) THEN
    RAISE EXCEPTION 'borrower not on this case' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_current
    FROM public.borrowers
   WHERE id = p_borrower_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'borrower % not found or deleted', p_borrower_id USING ERRCODE = 'P0002';
  END IF;

  v_safe_patch := p_patch
    - 'id' - 'created_at' - 'created_by' - 'updated_at' - 'updated_by' - 'deleted_at'
    - 'metadata';

  IF jsonb_typeof(v_safe_patch) <> 'object' OR v_safe_patch = '{}'::jsonb THEN
    RETURN FALSE;
  END IF;

  v_safe_patch := v_safe_patch
    || jsonb_build_object(
         'updated_by', v_actor::text,
         'updated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MSOF')
       );

  v_next := jsonb_populate_record(v_current, v_safe_patch);

  UPDATE public.borrowers
     SET first_name = v_next.first_name,
         last_name = v_next.last_name,
         national_id = v_next.national_id,
         id_issue_date = v_next.id_issue_date,
         id_expiry_date = v_next.id_expiry_date,
         birth_date = v_next.birth_date,
         gender = v_next.gender,
         marital_status = v_next.marital_status,
         children_count = v_next.children_count,
         citizenship = v_next.citizenship,
         additional_citizenships = v_next.additional_citizenships,
         residency_type = v_next.residency_type,
         preferred_language = v_next.preferred_language,
         phone = v_next.phone,
         landline_phone = v_next.landline_phone,
         email = v_next.email,
         address = v_next.address,
         city = v_next.city,
         employment_status = v_next.employment_status,
         employer_name = v_next.employer_name,
         credit_rating = v_next.credit_rating,
         owns_other_property = v_next.owns_other_property,
         related_to_sellers = v_next.related_to_sellers,
         notes = v_next.notes,
         relationship_in_case = v_next.relationship_in_case,
         updated_by = v_actor,
         updated_at = now()
   WHERE id = p_borrower_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.update_borrower_in_case(UUID, UUID, JSONB) TO authenticated;

DROP POLICY IF EXISTS message_templates_admin_all ON public.message_templates;
DROP POLICY IF EXISTS message_templates_admin_select ON public.message_templates;
DROP POLICY IF EXISTS message_templates_admin_insert ON public.message_templates;
DROP POLICY IF EXISTS message_templates_admin_update ON public.message_templates;
CREATE POLICY message_templates_admin_select ON public.message_templates
  FOR SELECT TO authenticated
  USING (public.is_admin() AND deleted_at IS NULL);
CREATE POLICY message_templates_admin_insert ON public.message_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND deleted_at IS NULL);
CREATE POLICY message_templates_admin_update ON public.message_templates
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
