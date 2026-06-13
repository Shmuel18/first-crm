-- =============================================================================
-- Migration 174: owner-scope leads_insert (R4-leads-1)
-- =============================================================================
-- leads_select (011) and leads_update (116) are owner-scoped: an advisor without
-- view_all_leads only sees/edits leads assigned to them. But leads_insert (011)
-- only checked has_permission('create_lead') — so a junior advisor could create
-- a lead assigned to ANY advisor (or unassigned), mis-attributing ownership and,
-- because select is owner-scoped, making the lead invisible to its own creator.
--
-- Fix: a caller WITHOUT view_all_leads may only insert a lead assigned to
-- themselves; managers/secretaries (view_all_leads) may still fan out / leave
-- unassigned. ADDITIONALLY, every inserted lead must be stamped created_by AND
-- updated_by = auth.uid() — a forged actor (claiming someone else created/updated
-- the lead, poisoning audit attribution) is rejected at the DB boundary. The
-- createLeadAction already stamps both to the caller. The submit_public_intake
-- RPC is SECURITY DEFINER and inserts as the owner role (created_by/updated_by
-- NULL), so it bypasses RLS and is unaffected.
--
-- Idempotent. Dependencies: 011 (the policy + has_permission), 143 (schema_version).
-- =============================================================================

DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('create_lead')
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
    AND (
      public.has_permission('view_all_leads')
      OR assigned_to = auth.uid()
    )
  );

INSERT INTO public.schema_version (version) VALUES (174) ON CONFLICT DO NOTHING;
