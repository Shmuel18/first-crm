-- =============================================================================
-- Migration 116: Scope lead writes to ownership + harden convert_lead_to_case
-- =============================================================================
-- Closes AUTHZ-1 (cross-advisor lead IDOR). Two write surfaces let any
-- edit_lead / authenticated user touch ANOTHER advisor's lead:
--
--   1. RLS policy `leads_update` (migration 011) checked only
--      has_permission('edit_lead') with NO ownership scope — so a junior
--      advisor (view_own_leads + edit_lead) could PATCH any lead by id via
--      PostgREST: steal it (set assigned_to = self) or corrupt its PII.
--      leads_select is correctly owner-scoped; the write side was not.
--
--   2. `convert_lead_to_case` (live = migration 053) is SECURITY DEFINER and
--      had NO permission check in its body — it relied solely on the GRANT to
--      `authenticated`, so any logged-in user could convert any lead by id via
--      a direct rpc() call (DEFINER bypasses leads_select).
--
-- This migration:
--   * Rewrites leads_update USING + WITH CHECK to mirror leads_select's
--     visibility scope (view_all_leads OR owned). You can only write a lead you
--     can see, and a non-manager cannot reassign a lead away from itself.
--   * Rewrites convert_lead_to_case to require auth + create_case + the same
--     lead-visibility scope before doing anything.
--
-- Two correctness fixes ride along (same function — not safe to leave them):
--   * Status: 053 inserts the case with case_statuses key='lead', but migration
--     086 DROPPED that row (086's own comment says convert should land on
--     'case_opened'). Post-086, convert was creating cases with a NULL status.
--     Fixed to 'case_opened' (matches create_case_draft / migration 092) with a
--     loud guard if the seed row is missing.
--   * SQLSTATEs: 053 used plain RAISE (P0001), so convert-lead.ts's code-based
--     mapping surfaced not_found / already_converted as 'unknown'. Restored the
--     explicit codes the action maps (P0002 / 22023 / 42501).
--
-- NOTE: leads_delete is intentionally NOT recreated — migration 022 dropped it,
-- so hard DELETE on leads stays denied by RLS (soft-delete only).
-- =============================================================================

-- 1. Owner-scoped lead writes (mirror leads_select) ---------------------------
DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
  USING (
    public.has_permission('edit_lead')
    AND (
      public.has_permission('view_all_leads')
      OR (public.has_permission('view_own_leads') AND assigned_to = auth.uid())
    )
  )
  WITH CHECK (
    public.has_permission('edit_lead')
    AND (
      public.has_permission('view_all_leads')
      OR (public.has_permission('view_own_leads') AND assigned_to = auth.uid())
    )
  );

-- 2. Hardened + corrected convert_lead_to_case --------------------------------
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

  INSERT INTO public.cases (
    primary_borrower_id, status_id, created_by, updated_by
  ) VALUES (
    v_borrower_id, v_status_id, v_actor, v_actor
  )
  RETURNING id INTO v_case_id;

  INSERT INTO public.case_borrowers (case_id, borrower_id, is_primary)
  VALUES (v_case_id, v_borrower_id, TRUE)
  ON CONFLICT (case_id, borrower_id) DO NOTHING;

  UPDATE public.leads
     SET status = 'converted',
         converted_case_id = v_case_id,
         updated_by = v_actor
   WHERE id = p_lead_id;

  RETURN v_case_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_case(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_case(UUID) TO authenticated;
