-- =============================================================================
-- Migration 099: per-case editable document checklist (case_checklist_items)
-- =============================================================================
-- Until now the documents checklist was COMPUTED on the fly from the global
-- case_type_documents template (migration 087) joined with uploaded docs.
-- That made it impossible to (a) tick a row "received" without uploading a
-- file, or (b) add/remove rows for a specific case.
--
-- This migration MATERIALIZES the checklist per case so it has its own
-- editable state. On first access of a case's checklist we copy the template
-- rows for the case's primary type into this table (get_or_create_case_checklist
-- below); from then on the case owns its list.
--
-- Row shape:
--   * Template rows  → document_category_id set, label NULL. Display name comes
--                      from document_categories (bilingual he/en).
--   * Manual rows    → label set (free text, user's language), category NULL.
--   * is_done        → the manual "received" tick. The TS service treats a row
--                      as complete when is_done OR a verified doc exists for its
--                      category (decision: manual check OR verified doc closes it).
--
-- Writes go ONLY through the SECURITY DEFINER RPCs below (no INSERT/UPDATE/
-- DELETE policy), each gated on edit-case permission + case access — mirroring
-- the case_expenses pattern (migration 081). SELECT is open to case viewers.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.case_checklist_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_category_id UUID REFERENCES public.document_categories(id) ON DELETE SET NULL,
  required_at_stage_id UUID REFERENCES public.case_statuses(id) ON DELETE SET NULL,
  label                TEXT,
  is_required          BOOLEAN NOT NULL DEFAULT TRUE,
  is_done              BOOLEAN NOT NULL DEFAULT FALSE,
  done_by              UUID REFERENCES public.profiles(id),
  done_at              TIMESTAMPTZ,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  source               TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('template', 'manual')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           UUID REFERENCES public.profiles(id),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by           UUID REFERENCES public.profiles(id)
);

-- A given template category appears at most once per case. Manual rows have a
-- NULL category and are unconstrained (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_checklist_case_category
  ON public.case_checklist_items(case_id, document_category_id)
  WHERE document_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_checklist_case
  ON public.case_checklist_items(case_id);

DROP TRIGGER IF EXISTS trg_case_checklist_items_updated_at ON public.case_checklist_items;
CREATE TRIGGER trg_case_checklist_items_updated_at
  BEFORE UPDATE ON public.case_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_checklist_items ENABLE ROW LEVEL SECURITY;

-- SELECT — anyone who can view the parent case.
DROP POLICY IF EXISTS "case_checklist_select" ON public.case_checklist_items;
CREATE POLICY "case_checklist_select" ON public.case_checklist_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.id = case_checklist_items.case_id
         AND c.deleted_at IS NULL
         AND public.can_view_case(c.id)
    )
  );

-- No INSERT/UPDATE/DELETE policies — all mutations flow through the
-- SECURITY DEFINER RPCs below, which enforce edit permission themselves.

-- -----------------------------------------------------------------------------
-- get_or_create_case_checklist — materialize-on-first-access, then return the
-- full list as JSONB (joined with category + stage for display). Idempotent:
-- only seeds when the case has zero rows AND a primary type is set.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_case_checklist(p_case_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor  UUID := auth.uid();
  v_type   UUID;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'no auth context' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_view_case(p_case_id) THEN
    RAISE EXCEPTION 'not authorized for this case' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.case_checklist_items WHERE case_id = p_case_id) THEN
    SELECT case_type_primary_id INTO v_type FROM public.cases WHERE id = p_case_id;
    IF v_type IS NOT NULL THEN
      INSERT INTO public.case_checklist_items
        (case_id, document_category_id, required_at_stage_id, is_required, sort_order, source, created_by)
      SELECT p_case_id, ctd.document_category_id, ctd.required_at_stage_id,
             ctd.is_required, ctd.sort_order, 'template', v_actor
        FROM public.case_type_documents ctd
        JOIN public.document_categories dc
          ON dc.id = ctd.document_category_id AND dc.is_active
       WHERE ctd.case_type_id = v_type
      ON CONFLICT (case_id, document_category_id) WHERE document_category_id IS NOT NULL
      DO NOTHING;
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', ci.id,
      'categoryId', ci.document_category_id,
      'categoryKey', dc.key,
      'nameHe', dc.name_he,
      'nameEn', dc.name_en,
      'label', ci.label,
      'driveFolder', dc.drive_folder,
      'isRequired', ci.is_required,
      'isDone', ci.is_done,
      'source', ci.source,
      'sortOrder', ci.sort_order,
      'requiredAtStage', CASE WHEN cs.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', cs.id, 'key', cs.key, 'name_he', cs.name_he, 'name_en', cs.name_en
      ) END
    ) AS item
    FROM public.case_checklist_items ci
    LEFT JOIN public.document_categories dc ON dc.id = ci.document_category_id
    LEFT JOIN public.case_statuses cs ON cs.id = ci.required_at_stage_id
    WHERE ci.case_id = p_case_id
    ORDER BY ci.sort_order, ci.created_at
  ) sub;

  RETURN v_result;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- Shared edit guard: raises 42501 unless the actor can edit the case.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._assert_can_edit_case(p_case_id UUID)
RETURNS VOID
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
    SELECT 1 FROM public.cases c
     WHERE c.id = p_case_id
       AND c.deleted_at IS NULL
       AND (
         public.has_permission('edit_any_case')
         OR (public.has_permission('edit_own_case') AND c.assigned_advisor_id = v_actor)
       )
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this case' USING ERRCODE = '42501';
  END IF;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- toggle_case_checklist_item — set the manual "received" tick.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_case_checklist_item(
  p_case_id UUID,
  p_item_id UUID,
  p_done    BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  PERFORM public._assert_can_edit_case(p_case_id);

  UPDATE public.case_checklist_items
     SET is_done    = p_done,
         done_by    = CASE WHEN p_done THEN v_actor ELSE NULL END,
         done_at    = CASE WHEN p_done THEN now() ELSE NULL END,
         updated_by = v_actor
   WHERE id = p_item_id
     AND case_id = p_case_id;

  RETURN FOUND;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- add_case_checklist_item — append a free-text manual row at the end.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_case_checklist_item(
  p_case_id UUID,
  p_label   TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_next  INTEGER;
  v_id    UUID;
  v_label TEXT := btrim(p_label);
BEGIN
  PERFORM public._assert_can_edit_case(p_case_id);

  IF v_label IS NULL OR length(v_label) = 0 THEN
    RAISE EXCEPTION 'empty label' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next
    FROM public.case_checklist_items WHERE case_id = p_case_id;

  INSERT INTO public.case_checklist_items
    (case_id, label, is_required, sort_order, source, created_by, updated_by)
  VALUES
    (p_case_id, left(v_label, 200), FALSE, v_next, 'manual', v_actor, v_actor)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- remove_case_checklist_item — hard delete. UI confirms when a linked doc
-- exists; the document itself is never touched here.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_case_checklist_item(
  p_case_id UUID,
  p_item_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public._assert_can_edit_case(p_case_id);

  DELETE FROM public.case_checklist_items
   WHERE id = p_item_id AND case_id = p_case_id;

  RETURN FOUND;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- reorder_case_checklist_items — set sort_order from array position.
-- Items not in the array keep their order after the listed ones.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reorder_case_checklist_items(
  p_case_id UUID,
  p_ids     UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  PERFORM public._assert_can_edit_case(p_case_id);

  UPDATE public.case_checklist_items ci
     SET sort_order = pos.ord,
         updated_by = v_actor
    FROM (
      SELECT id, ordinality AS ord
        FROM unnest(p_ids) WITH ORDINALITY AS u(id, ordinality)
    ) pos
   WHERE ci.id = pos.id AND ci.case_id = p_case_id;

  RETURN TRUE;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_or_create_case_checklist(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_can_edit_case(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_case_checklist_item(UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_case_checklist_item(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_case_checklist_item(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_case_checklist_items(UUID, UUID[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_or_create_case_checklist(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_case_checklist_item(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_case_checklist_item(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_case_checklist_item(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_case_checklist_items(UUID, UUID[]) TO authenticated;

COMMENT ON TABLE public.case_checklist_items IS
  'Per-case materialized document checklist. Seeded from case_type_documents on first access; editable per case (tick/add/remove/reorder). See migration 099.';
