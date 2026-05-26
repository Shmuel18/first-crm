-- =============================================================================
-- Migration 064: Per-case write scope for borrower mutations (DI6 fix)
-- =============================================================================
-- The original borrowers_modify policy (migrations 011 + 022) allows an
-- UPDATE when the borrower is on ANY case the caller can edit. Real
-- vulnerability: if borrower B is on case A (yours) AND case Z (someone
-- else's), you can mutate B's name/national_id/address, corrupting case
-- Z's view of the borrower for its rightful editor.
--
-- This migration moves to a stricter model:
--   - Direct UPDATE/INSERT/DELETE on public.borrowers requires edit_any_case
--     (admin only). The "advisor with edit_own_case" path is closed at the
--     DB layer.
--   - Non-admin callers go through update_borrower_in_case() — a
--     SECURITY DEFINER RPC that takes p_case_id explicitly and verifies
--     (a) the caller can edit THAT specific case AND (b) the borrower is
--     linked to THAT specific case.
--   - The existing save_borrower_for_case RPC (migration 055) is upgraded
--     to SECURITY DEFINER + the same scope check so non-admin save flows
--     keep working.
--
-- Defense-in-depth: the action layer (update-borrower-field,
-- save-borrower) already does these checks. This migration makes the
-- DB layer enforce them too — a future code path that forgets the
-- check can't accidentally regress the rule, and a direct REST query
-- (POST /rest/v1/borrowers from a compromised session) is now refused.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tighten borrowers_modify to admin-direct-only
-- -----------------------------------------------------------------------------
-- SELECT stays open per borrowers_select (migration 011).
-- Non-admin writes route through the RPC below.
DROP POLICY IF EXISTS "borrowers_modify" ON public.borrowers;
CREATE POLICY "borrowers_modify" ON public.borrowers FOR ALL TO authenticated
  USING (public.has_permission('edit_any_case'))
  WITH CHECK (public.has_permission('edit_any_case'));

-- -----------------------------------------------------------------------------
-- 2. update_borrower_in_case — scope-checked patch RPC
-- -----------------------------------------------------------------------------
-- p_patch is a JSONB object of column → value. Server-controlled columns
-- (id, created_at, created_by, updated_at, updated_by, deleted_at) are
-- stripped server-side. updated_by + updated_at are stamped by this
-- function. Uses jsonb_populate_record for per-column type-cast safety.
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
  v_rows INT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  -- Scope check 1: caller can edit THIS case (not just borrower's other cases).
  -- edit_any_case bypass mirrors the policy — admins go straight through.
  IF NOT EXISTS (
    SELECT 1 FROM public.cases
     WHERE id = p_case_id AND deleted_at IS NULL
       AND (assigned_advisor_id = v_actor OR public.has_permission('edit_any_case'))
  ) THEN
    RAISE EXCEPTION 'not authorized for this case' USING ERRCODE = '42501';
  END IF;

  -- Scope check 2: borrower is linked to p_case_id specifically.
  IF NOT EXISTS (
    SELECT 1 FROM public.case_borrowers
     WHERE case_id = p_case_id AND borrower_id = p_borrower_id
  ) THEN
    RAISE EXCEPTION 'borrower not on this case' USING ERRCODE = '42501';
  END IF;

  -- Strip server-controlled columns. updated_by + updated_at are forced
  -- below to make sure they reflect the actor + now() regardless of input.
  v_safe_patch := p_patch
    - 'id' - 'created_at' - 'created_by' - 'updated_at' - 'updated_by' - 'deleted_at'
    - 'metadata';  -- metadata stays admin-only (parallel to profiles.metadata guard)

  IF jsonb_typeof(v_safe_patch) <> 'object' OR v_safe_patch = '{}'::jsonb THEN
    RETURN FALSE; -- nothing to apply
  END IF;

  -- Stamp actor + now() before the populate-record merge.
  v_safe_patch := v_safe_patch
    || jsonb_build_object(
         'updated_by', v_actor::text,
         'updated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MSOF')
       );

  -- jsonb_populate_record handles per-column type casts (TEXT/INT/BOOL/DATE
  -- etc.) using the borrowers row type as the schema. We re-assign the full
  -- column set via the populated record so partial-patch semantics work
  -- (unchanged columns keep their current value from the row).
  UPDATE public.borrowers AS b
     SET first_name = p.first_name,
         last_name = p.last_name,
         national_id = p.national_id,
         id_issue_date = p.id_issue_date,
         id_expiry_date = p.id_expiry_date,
         birth_date = p.birth_date,
         gender = p.gender,
         marital_status = p.marital_status,
         children_count = p.children_count,
         citizenship = p.citizenship,
         additional_citizenships = p.additional_citizenships,
         residency_type = p.residency_type,
         preferred_language = p.preferred_language,
         phone = p.phone,
         landline_phone = p.landline_phone,
         email = p.email,
         address = p.address,
         city = p.city,
         employment_status = p.employment_status,
         employer_name = p.employer_name,
         credit_rating = p.credit_rating,
         owns_other_property = p.owns_other_property,
         related_to_sellers = p.related_to_sellers,
         notes = p.notes,
         relationship_in_case = p.relationship_in_case,
         updated_by = p.updated_by,
         updated_at = p.updated_at
    FROM jsonb_populate_record(b, v_safe_patch) AS p
   WHERE b.id = p_borrower_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.update_borrower_in_case(UUID, UUID, JSONB) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Upgrade save_borrower_for_case to SECURITY DEFINER + per-case scope check
-- -----------------------------------------------------------------------------
-- Migration 055 created this as SECURITY INVOKER, which depended on the
-- looser borrowers_modify policy. With the tightened policy, non-admins
-- would lose write access via the RPC. Re-create as SECURITY DEFINER
-- and add the same scope check.
CREATE OR REPLACE FUNCTION public.save_borrower_for_case(
  p_case_id UUID,
  p_borrower_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_national_id TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_birth_date DATE,
  p_is_primary BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_borrower_id UUID;
  v_actor UUID := auth.uid();
BEGIN
  IF p_case_id IS NULL THEN
    RAISE EXCEPTION 'save_borrower_for_case: p_case_id is required';
  END IF;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;

  -- Scope check: caller must be able to edit p_case_id.
  IF NOT EXISTS (
    SELECT 1 FROM public.cases
     WHERE id = p_case_id AND deleted_at IS NULL
       AND (assigned_advisor_id = v_actor OR public.has_permission('edit_any_case'))
  ) THEN
    RAISE EXCEPTION 'not authorized for this case' USING ERRCODE = '42501';
  END IF;

  IF p_borrower_id IS NULL THEN
    -- New borrower. Reuse-by-national_id matches migration 053's intent.
    IF p_national_id IS NOT NULL THEN
      SELECT id INTO v_borrower_id
        FROM public.borrowers
       WHERE national_id = p_national_id AND deleted_at IS NULL
       LIMIT 1;
    END IF;
    IF v_borrower_id IS NULL THEN
      INSERT INTO public.borrowers (
        first_name, last_name, national_id, phone, email, birth_date,
        created_by, updated_by
      ) VALUES (
        p_first_name, p_last_name, p_national_id, p_phone, p_email, p_birth_date,
        v_actor, v_actor
      )
      RETURNING id INTO v_borrower_id;
    ELSE
      UPDATE public.borrowers
         SET first_name = COALESCE(p_first_name, first_name),
             last_name = COALESCE(p_last_name, last_name),
             phone = COALESCE(p_phone, phone),
             email = COALESCE(p_email, email),
             birth_date = COALESCE(p_birth_date, birth_date),
             updated_by = v_actor
       WHERE id = v_borrower_id;
    END IF;
  ELSE
    v_borrower_id := p_borrower_id;
    -- For an existing borrower-on-this-case update, verify the link.
    IF NOT EXISTS (
      SELECT 1 FROM public.case_borrowers
       WHERE case_id = p_case_id AND borrower_id = v_borrower_id
    ) THEN
      RAISE EXCEPTION 'borrower not on this case' USING ERRCODE = '42501';
    END IF;
    UPDATE public.borrowers
       SET first_name = p_first_name,
           last_name = p_last_name,
           national_id = p_national_id,
           phone = p_phone,
           email = p_email,
           birth_date = p_birth_date,
           updated_by = v_actor
     WHERE id = v_borrower_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'borrower % not found or deleted', v_borrower_id;
    END IF;
  END IF;

  INSERT INTO public.case_borrowers (case_id, borrower_id, is_primary)
  VALUES (p_case_id, v_borrower_id, COALESCE(p_is_primary, FALSE))
  ON CONFLICT (case_id, borrower_id) DO UPDATE
    SET is_primary = COALESCE(EXCLUDED.is_primary, public.case_borrowers.is_primary);

  IF p_is_primary THEN
    UPDATE public.case_borrowers
       SET is_primary = FALSE
     WHERE case_id = p_case_id
       AND borrower_id <> v_borrower_id
       AND is_primary = TRUE;

    UPDATE public.cases
       SET primary_borrower_id = v_borrower_id,
           updated_by = v_actor
     WHERE id = p_case_id;
  END IF;

  RETURN v_borrower_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.save_borrower_for_case(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN)
  TO authenticated;
