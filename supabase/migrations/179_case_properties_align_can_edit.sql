-- =============================================================================
-- Migration 179: case_properties authority = can_edit_case + actor anti-forgery
--                (R5-advisors-properties-email-1)
-- =============================================================================
-- The case_properties INSERT/UPDATE policies and soft_delete_case_property RPC
-- (mig 156) scoped the "own case" branch to assigned_advisor_id = auth.uid()
-- ONLY, so an ASSOCIATED advisor (mig 146/147) — who the actions authorize via
-- can_edit_case (which includes associated advisors) — passed the action gate but
-- was RLS-denied at the DB: add/remove failed generically and an inline EDIT
-- silently matched 0 rows and kept the optimistic value (silent data loss).
--
-- Fix: route every policy + the RPC through the canonical public.can_edit_case()
-- so the authority lives in ONE place and matches the rest of the case. Also pin
-- created_by/updated_by to auth.uid() in the WITH CHECK so the actor can't be
-- forged (mirrors leads_insert, mig 174). The actions already stamp both to the
-- caller; the UPDATE action's 0-row check (separate code change) makes the
-- previously-silent denial surface.
--
-- Idempotent. Dependencies: 156 (table + prior policies), 147 (can_edit_case),
-- 143 (schema_version).
-- =============================================================================

-- INSERT — caller must be able to edit the case AND stamp themselves.
DROP POLICY IF EXISTS "case_properties_insert" ON public.case_properties;
CREATE POLICY "case_properties_insert" ON public.case_properties
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
    AND public.can_edit_case(case_id)
  );

-- UPDATE — edit authority on both sides; updated_by pinned to the actor.
DROP POLICY IF EXISTS "case_properties_update" ON public.case_properties;
CREATE POLICY "case_properties_update" ON public.case_properties
  FOR UPDATE TO authenticated
  USING (public.can_edit_case(case_id))
  WITH CHECK (
    updated_by = auth.uid()
    AND public.can_edit_case(case_id)
  );

-- soft-delete RPC — same canonical authority (was inlined assigned-only scope).
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

  -- The property must belong to the (live) case and still be live.
  IF NOT EXISTS (
    SELECT 1
      FROM public.case_properties p
      JOIN public.cases c ON c.id = p.case_id
     WHERE p.id = p_property_id
       AND p.case_id = p_case_id
       AND p.deleted_at IS NULL
       AND c.deleted_at IS NULL
  ) THEN
    RETURN FALSE;
  END IF;

  -- Canonical edit authority (includes associated advisors).
  IF NOT public.can_edit_case(p_case_id) THEN
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

INSERT INTO public.schema_version (version) VALUES (179) ON CONFLICT DO NOTHING;
