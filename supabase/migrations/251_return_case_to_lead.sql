-- 251 — return a case to the leads list, and bring the SAME case back later.
--
-- The office asked (2026-10-29) for a "return to leads" action: a case that
-- turned out to be premature leaves the active list and waits as a lead. The
-- case itself is NOT deleted — it goes dormant in the ARCHIVE with its
-- documents, notes and history intact, and the lead points at it through
-- leads.dormant_case_id. Converting that lead again revives the dormant case
-- instead of opening an empty new one.
--
-- Why the archive and not a soft delete: soft-deleted cases are swept by the
-- retention purge (cleanup_soft_deleted_records + the TS file eraser) after
-- deleted_records_retention_days — a lead that waits a month would lose its
-- case and files. Archived cases are never purged. Archiving an active-status
-- case by hand is already allowed (migration 226 only derives the flag on
-- status writes).
--
-- Permission: archive_case + create_lead, plus the canonical can_edit_case —
-- existing, role-configurable keys (no hardcoded role check).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS dormant_case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leads.dormant_case_id IS
  'A case returned to leads (migration 251): archived and kept whole. '
  'Converting this lead revives that case (revive_dormant_case_for_lead).';

-- Hot path is "does this lead have a dormant case" on a small table; the FK
-- index keeps cases deletes/joins cheap.
CREATE INDEX IF NOT EXISTS idx_leads_dormant_case
  ON public.leads(dormant_case_id)
  WHERE dormant_case_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- return_case_to_lead(case) → lead id
--   Reuses the lead the case was converted from when there is one (reactivated),
--   otherwise creates a lead from the primary borrower. Assigned to the case's
--   responsible advisor so view_own_leads keeps it visible to them.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_case_to_lead(p_case_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_case RECORD;
  v_borrower RECORD;
  v_lead_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'return_case_to_lead: no auth context' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_permission('archive_case') AND public.has_permission('create_lead')) THEN
    RAISE EXCEPTION 'return_case_to_lead: missing permission' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_edit_case(p_case_id) THEN
    RAISE EXCEPTION 'return_case_to_lead: not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT id, primary_borrower_id, assigned_advisor_id, short_note
    INTO v_case
    FROM public.cases
   WHERE id = p_case_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'return_case_to_lead: case % not found', p_case_id USING ERRCODE = 'P0002';
  END IF;

  -- The lead this case was converted from, if any — bring it back.
  SELECT id INTO v_lead_id
    FROM public.leads
   WHERE converted_to_case_id = p_case_id AND deleted_at IS NULL
   ORDER BY converted_at DESC NULLS LAST
   LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    UPDATE public.leads
       SET status = 'active',
           converted_at = NULL,
           converted_to_case_id = NULL,
           dormant_case_id = p_case_id,
           assigned_to = COALESCE(v_case.assigned_advisor_id, assigned_to),
           updated_by = v_actor
     WHERE id = v_lead_id;
  ELSE
    SELECT first_name, last_name, national_id, phone, email
      INTO v_borrower
      FROM public.borrowers
     WHERE id = v_case.primary_borrower_id;

    INSERT INTO public.leads (
      first_name, last_name, national_id, phone, email, status, assigned_to,
      notes, dormant_case_id, created_by, updated_by
    ) VALUES (
      v_borrower.first_name, v_borrower.last_name, v_borrower.national_id,
      v_borrower.phone, v_borrower.email, 'active',
      COALESCE(v_case.assigned_advisor_id, v_actor),
      v_case.short_note, p_case_id, v_actor, v_actor
    )
    RETURNING id INTO v_lead_id;
  END IF;

  UPDATE public.cases
     SET is_archived = TRUE, updated_by = v_actor
   WHERE id = p_case_id;

  RETURN v_lead_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.return_case_to_lead(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.return_case_to_lead(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- revive_dormant_case_for_lead(lead) → case id, or NULL when the lead has no
--   dormant case (the caller then runs the normal convert_lead_to_case).
--   Same gates as convert_lead_to_case (create_case + lead visibility).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revive_dormant_case_for_lead(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_lead RECORD;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'revive_dormant_case_for_lead: no auth context' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission('create_case') THEN
    RAISE EXCEPTION 'revive_dormant_case_for_lead: missing create_case' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'revive_dormant_case_for_lead: lead % not found', p_lead_id USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.has_permission('view_all_leads')
    OR (public.has_permission('view_own_leads') AND v_lead.assigned_to = v_actor)
  ) THEN
    RAISE EXCEPTION 'revive_dormant_case_for_lead: not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_lead.dormant_case_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_lead.status IS NOT NULL AND v_lead.status <> 'active' THEN
    RAISE EXCEPTION 'revive_dormant_case_for_lead: lead % is not active', p_lead_id USING ERRCODE = '22023';
  END IF;

  -- Back to the active list — unless its status is one that lives in the
  -- archive by rule (closed / on_hold / stuck, migrations 226/227).
  UPDATE public.cases c
     SET is_archived = COALESCE(
           (SELECT s.key IN ('closed', 'on_hold', 'stuck') FROM public.case_statuses s WHERE s.id = c.status_id),
           FALSE
         ),
         updated_by = v_actor
   WHERE c.id = v_lead.dormant_case_id
     AND c.deleted_at IS NULL;
  IF NOT FOUND THEN
    -- The case was deleted meanwhile — let the caller open a fresh one.
    UPDATE public.leads SET dormant_case_id = NULL WHERE id = p_lead_id;
    RETURN NULL;
  END IF;

  UPDATE public.leads
     SET status = 'converted',
         converted_at = now(),
         converted_to_case_id = v_lead.dormant_case_id,
         dormant_case_id = NULL,
         updated_by = v_actor
   WHERE id = p_lead_id;

  RETURN v_lead.dormant_case_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.revive_dormant_case_for_lead(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revive_dormant_case_for_lead(UUID) TO authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (251) ON CONFLICT DO NOTHING;
