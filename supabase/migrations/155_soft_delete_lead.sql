-- =============================================================================
-- Migration 155: soft_delete_lead RPC
-- =============================================================================
-- Adds the missing "delete lead" path. Two constraints shaped this:
--   * Hard DELETE on leads is denied by RLS (migration 022 dropped leads_delete)
--     — the app does soft-delete only (deleted_at; leads.service filters it).
--   * leads_update RLS (migration 116) is gated on edit_lead, but product wants
--     delete to require create_case (same gate as "convert to case").
--
-- So this mirrors convert_lead_to_case exactly: SECURITY DEFINER, requires auth
-- + create_case, and re-checks lead visibility (the same IDOR guard as
-- leads_select / convert) before setting deleted_at. Reversible by design.
-- Explicit SQLSTATEs match what delete-lead.ts maps (P0002 / 42501).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_lead(p_lead_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_lead  RECORD;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'soft_delete_lead: no auth context' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission('create_case') THEN
    RAISE EXCEPTION 'soft_delete_lead: missing create_case permission' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lead
    FROM public.leads
   WHERE id = p_lead_id
     AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'soft_delete_lead: lead % not found', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  -- IDOR guard: only delete a lead you are allowed to SEE (mirrors leads_select
  -- and convert_lead_to_case). DEFINER bypasses RLS, so this check is required.
  IF NOT (
    public.has_permission('view_all_leads')
    OR (public.has_permission('view_own_leads') AND v_lead.assigned_to = v_actor)
  ) THEN
    RAISE EXCEPTION 'soft_delete_lead: not authorized for lead %', p_lead_id USING ERRCODE = '42501';
  END IF;

  UPDATE public.leads
     SET deleted_at = now(),
         updated_by = v_actor
   WHERE id = p_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_lead(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_lead(UUID) TO authenticated;

INSERT INTO public.schema_version (version) VALUES (155) ON CONFLICT DO NOTHING;
