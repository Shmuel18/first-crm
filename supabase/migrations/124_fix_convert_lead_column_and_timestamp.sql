-- =============================================================================
-- Migration 124: fix the broken lead→case conversion (WF-1)
-- =============================================================================
-- convert_lead_to_case (live = migration 116, inherited from 053) ends with:
--     UPDATE public.leads SET ..., converted_case_id = v_case_id, ...
-- but the leads table has NO `converted_case_id` column — the real column is
-- `converted_to_case_id` (migration 005). plpgsql doesn't validate column
-- references at CREATE time, so the function installed cleanly but throws
-- `undefined_column` at RUNTIME on the happy path. Because the function is one
-- transaction, that throw ROLLS BACK the just-created case + borrower, so
-- "Convert lead to case" has been completely non-functional since migration 053
-- (latent: pre-launch, and the IDOR tests only exercised the auth-denial path,
-- which raises before reaching this UPDATE).
--
-- Two fixes, both in the final UPDATE (nothing else changes vs 116 — the IDOR
-- guards, create_case check, case_opened status, and borrower dedup all stay;
-- the new case is still left UNASSIGNED on purpose so the manager distributes it):
--   * converted_case_id  -> converted_to_case_id   (the real column)
--   * converted_at = now()                          (regression: 031/033 set it,
--                                                    053 dropped it; restore so
--                                                    lead→case lag is recorded)
-- A pgTAP happy-path test (supabase/tests) now actually converts a lead, so this
-- class of runtime-only bug can't hide again.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.convert_lead_to_case(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_case_id UUID;
  v_borrower_id UUID;
  v_status_id UUID;
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'convert_lead_to_case: no auth context' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission('create_case') THEN
    RAISE EXCEPTION 'convert_lead_to_case: missing create_case permission' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'convert_lead_to_case: lead % not found', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  -- IDOR guard: only convert a lead you are allowed to SEE (mirrors leads_select).
  IF NOT (
    public.has_permission('view_all_leads')
    OR (public.has_permission('view_own_leads') AND v_lead.assigned_to = v_actor)
  ) THEN
    RAISE EXCEPTION 'convert_lead_to_case: not authorized for lead %', p_lead_id USING ERRCODE = '42501';
  END IF;

  -- Status guard (migration 033): only "active" leads convert.
  IF v_lead.status IS NOT NULL AND v_lead.status <> 'active' THEN
    RAISE EXCEPTION 'convert_lead_to_case: lead % is not active (status=%)',
      p_lead_id, v_lead.status USING ERRCODE = '22023';
  END IF;

  -- New cases open on 'case_opened' (the 'lead' status was dropped in 086).
  SELECT id INTO v_status_id FROM public.case_statuses WHERE key = 'case_opened' LIMIT 1;
  IF v_status_id IS NULL THEN
    RAISE EXCEPTION 'convert_lead_to_case: case_opened status row missing — seed data not loaded';
  END IF;

  -- Reuse an existing borrower by national_id (migration 053 dedup).
  IF v_lead.national_id IS NOT NULL THEN
    SELECT id INTO v_borrower_id
      FROM public.borrowers
     WHERE national_id = v_lead.national_id
       AND deleted_at IS NULL
     LIMIT 1;
  END IF;

  IF v_borrower_id IS NULL THEN
    INSERT INTO public.borrowers (
      first_name, last_name, national_id, phone, email, created_by, updated_by
    ) VALUES (
      v_lead.first_name, v_lead.last_name, v_lead.national_id,
      v_lead.phone, v_lead.email, v_actor, v_actor
    )
    RETURNING id INTO v_borrower_id;
  END IF;

  -- Case left UNASSIGNED by design (assigned_advisor_id NULL): converted cases
  -- land in the manager's queue to distribute (manager has view_all_cases).
  INSERT INTO public.cases (
    primary_borrower_id, status_id, created_by, updated_by
  ) VALUES (
    v_borrower_id, v_status_id, v_actor, v_actor
  )
  RETURNING id INTO v_case_id;

  INSERT INTO public.case_borrowers (case_id, borrower_id, is_primary)
  VALUES (v_case_id, v_borrower_id, TRUE)
  ON CONFLICT (case_id, borrower_id) DO NOTHING;

  -- FIX (WF-1): correct column (converted_to_case_id, not the non-existent
  -- converted_case_id) + restore converted_at (dropped in 053).
  UPDATE public.leads
     SET status = 'converted',
         converted_to_case_id = v_case_id,
         converted_at = now(),
         updated_by = v_actor
   WHERE id = p_lead_id;

  RETURN v_case_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_case(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_case(UUID) TO authenticated;
