-- =============================================================================
-- Migration 146: associated advisors on a case (0..N) — the "יועץ משוייך" model
-- =============================================================================
-- A case keeps its single RESPONSIBLE advisor in cases.assigned_advisor_id
-- ("יועץ אחראי"). This adds 0..N ASSOCIATED advisors ("יועצים משוייכים") — e.g.
-- when another advisor does a small piece of work inside the case. An associated
-- advisor can VIEW and EDIT the case (same as responsible); migration 147 wires
-- that into the case RLS. The agreed-fee stays manager-only (view_case_fee),
-- unaffected here.
--
-- Managed by holders of the existing `assign_case_to_user` permission (senior
-- advisor / admin) — the same gate that controls reassigning the responsible
-- advisor. Visible to anyone who can view the case.
--
-- Idempotent. Dependencies: 006 (cases), 002 (profiles/has_permission),
-- 039 (can_view_case). 147 then extends can_view_case/can_edit_case/cases RLS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.case_associated_advisors (
  case_id    UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by   UUID REFERENCES public.profiles(id),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, advisor_id)
);

COMMENT ON TABLE public.case_associated_advisors IS
  'Secondary advisors associated to a case (0..N), in addition to the single responsible advisor (cases.assigned_advisor_id). An associated advisor can view AND edit the case (see migration 147); the agreed-fee stays manager-only. Managed by assign_case_to_user holders.';

-- PK (case_id, advisor_id) already serves the per-row EXISTS in the case
-- policies (filter by case_id + advisor_id). This reverse index serves
-- "which cases is advisor X associated with" (the dashboard "my cases" + filter).
CREATE INDEX IF NOT EXISTS idx_case_assoc_advisors_advisor
  ON public.case_associated_advisors(advisor_id);

ALTER TABLE public.case_associated_advisors ENABLE ROW LEVEL SECURITY;

-- Is the current user an associated advisor of this case? SECURITY DEFINER so it
-- bypasses THIS table's RLS when called from the cases policies (no recursion —
-- it never reads public.cases). auth.uid() still resolves to the real caller
-- inside a DEFINER function. STABLE for per-statement caching.
CREATE OR REPLACE FUNCTION public.is_case_associated_advisor(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.case_associated_advisors caa
     WHERE caa.case_id = p_case_id
       AND caa.advisor_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_case_associated_advisor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_case_associated_advisor(uuid) TO authenticated;

-- RLS:
--   SELECT  — anyone who can view the case (lists associates on the case page /
--             dashboard). can_view_case is itself extended in 147 to include
--             associates, so an associate can see the full associate list too.
--   INSERT/DELETE — assign_case_to_user holders, scoped to cases they can view.
DROP POLICY IF EXISTS "case_assoc_advisors_select" ON public.case_associated_advisors;
CREATE POLICY "case_assoc_advisors_select" ON public.case_associated_advisors
  FOR SELECT TO authenticated
  USING (public.can_view_case(case_id));

DROP POLICY IF EXISTS "case_assoc_advisors_insert" ON public.case_associated_advisors;
CREATE POLICY "case_assoc_advisors_insert" ON public.case_associated_advisors
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('assign_case_to_user') AND public.can_view_case(case_id));

DROP POLICY IF EXISTS "case_assoc_advisors_delete" ON public.case_associated_advisors;
CREATE POLICY "case_assoc_advisors_delete" ON public.case_associated_advisors
  FOR DELETE TO authenticated
  USING (public.has_permission('assign_case_to_user') AND public.can_view_case(case_id));

INSERT INTO public.schema_version (version) VALUES (146) ON CONFLICT DO NOTHING;
