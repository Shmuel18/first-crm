-- =============================================================================
-- Migration 024: RLS layer 2 + integrity constraints
-- =============================================================================
-- Closes review findings #2, #3, #4, #5, #7 from the multi-discipline audit:
--   - case_borrowers / case_banks / documents writes require BOTH the action
--     permission AND edit permission on the parent case (was visibility only).
--   - Soft-delete on cases (deleted_at NULL → NOT NULL) requires delete_case;
--     restoring requires the same. The cases_update policy alone let any
--     editor soft-delete the case after migration 022 dropped FOR DELETE.
--   - Partial UNIQUE indexes enforce "one primary per case" atomically and
--     allow re-adding a bank that was previously soft-deleted.
-- Dependencies: 011, 022
-- =============================================================================

-- =============================================================================
-- 1. case_borrowers — split FOR ALL into per-verb policies
-- =============================================================================
DROP POLICY IF EXISTS "case_borrowers_via_case" ON public.case_borrowers;

CREATE POLICY "case_borrowers_select" ON public.case_borrowers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "case_borrowers_insert" ON public.case_borrowers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  );

CREATE POLICY "case_borrowers_update" ON public.case_borrowers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  );

CREATE POLICY "case_borrowers_delete" ON public.case_borrowers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  );

-- =============================================================================
-- 2. case_banks — tighten insert/update to require edit permission
-- =============================================================================
DROP POLICY IF EXISTS "case_banks_insert" ON public.case_banks;
DROP POLICY IF EXISTS "case_banks_update" ON public.case_banks;

CREATE POLICY "case_banks_insert" ON public.case_banks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  );

CREATE POLICY "case_banks_update" ON public.case_banks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  );

-- (case_banks_select from 022 stays - visibility is correct as just case-visibility.)

-- =============================================================================
-- 3. documents — write policies require BOTH document perm AND case edit perm
-- =============================================================================
DROP POLICY IF EXISTS "documents_insert" ON public.documents;
DROP POLICY IF EXISTS "documents_update" ON public.documents;

CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('upload_document')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  );

CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    (public.has_permission('verify_document') OR public.has_permission('upload_document'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    (public.has_permission('verify_document') OR public.has_permission('upload_document'))
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
        AND c.deleted_at IS NULL
        AND (
          public.has_permission('edit_any_case')
          OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = auth.uid())
        )
    )
  );

-- =============================================================================
-- 4. Guard cases.deleted_at transition with delete_case permission (#4)
-- =============================================================================
-- After migration 022 dropped the hard DELETE policy, soft-delete is done via
-- UPDATE deleted_at. The cases_update policy allows that for any editor, so
-- the delete_case permission was effectively bypassed. Enforce it via trigger.
CREATE OR REPLACE FUNCTION public.guard_case_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- System / admin paths bypass the guard
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Soft-delete (NULL → value)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    IF NOT public.has_permission('delete_case') THEN
      RAISE EXCEPTION 'Missing delete_case permission for soft-delete';
    END IF;
  END IF;

  -- Restore (value → NULL)
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    IF NOT public.has_permission('delete_case') THEN
      RAISE EXCEPTION 'Missing delete_case permission to restore soft-deleted case';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cases_guard_soft_delete ON public.cases;
CREATE TRIGGER trg_cases_guard_soft_delete
  BEFORE UPDATE OF deleted_at ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.guard_case_soft_delete();

-- =============================================================================
-- 5. Partial UNIQUE indexes for primary + active dedup (#5, #7)
-- =============================================================================

-- case_banks: drop the always-on unique, replace with partial active-only
-- so a soft-deleted bank can be re-added.
ALTER TABLE public.case_banks
  DROP CONSTRAINT IF EXISTS case_banks_case_id_bank_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_case_banks_active
  ON public.case_banks(case_id, bank_id)
  WHERE deleted_at IS NULL;

-- One primary bank per case (active rows). Atomic at the DB level, so the
-- AFTER trigger race window is closed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_banks_one_primary
  ON public.case_banks(case_id)
  WHERE is_primary = TRUE AND deleted_at IS NULL;

-- One primary borrower per case. case_borrowers has no soft-delete column
-- (hard-deleted on remove) so no deleted_at filter needed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_borrowers_one_primary
  ON public.case_borrowers(case_id)
  WHERE is_primary = TRUE;
