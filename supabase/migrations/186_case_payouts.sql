-- =============================================================================
-- Migration 186: case_payouts — per-case commissions & salaries (manager-only)
-- =============================================================================
-- A manager-only section in the admin block, next to the agreed fee: who gets
-- paid out of this case's fee and how much ("advisor 10,000", "referrer 3,000").
-- Feeds the NET fee figure in statistics (gross fee − sum of payouts).
--
-- MANAGER-ONLY: gated by public.is_admin() at the RLS layer — same as
-- case_financials (migration 025). The fee itself is admin-only, so the
-- breakdown of how it's split must be at least as protected.
--
-- Soft-delete only (no DELETE policy) via soft_delete_case_payout, mirroring
-- case_expenses (migration 081) and the borrower-financial tables.
-- Dependencies: 002 (is_admin), 006 (cases).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.case_payouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  recipient   TEXT,
  amount      NUMERIC(15, 2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id),
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_case_payouts_case
  ON public.case_payouts(case_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_case_payouts_updated_at
  BEFORE UPDATE ON public.case_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_payouts ENABLE ROW LEVEL SECURITY;

-- SELECT / INSERT / UPDATE — manager (admin) only. No DELETE policy: removal is
-- the soft-delete RPC below.
DROP POLICY IF EXISTS "case_payouts_select" ON public.case_payouts;
CREATE POLICY "case_payouts_select" ON public.case_payouts
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_admin());

DROP POLICY IF EXISTS "case_payouts_insert" ON public.case_payouts;
CREATE POLICY "case_payouts_insert" ON public.case_payouts
  FOR INSERT TO authenticated
  WITH CHECK (deleted_at IS NULL AND public.is_admin());

DROP POLICY IF EXISTS "case_payouts_update" ON public.case_payouts;
CREATE POLICY "case_payouts_update" ON public.case_payouts
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.soft_delete_case_payout(
  p_case_id   UUID,
  p_payout_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.case_payouts
     SET deleted_at = now(),
         deleted_by = v_actor,
         updated_by = v_actor
   WHERE id = p_payout_id
     AND case_id = p_case_id
     AND deleted_at IS NULL;

  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soft_delete_case_payout(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_case_payout(UUID, UUID) TO authenticated;

COMMENT ON TABLE public.case_payouts IS
  'Manager-only per-case commissions/salaries paid out of the fee. Feeds the '
  'NET fee in statistics. is_admin() RLS, soft-delete. See migration 186.';

INSERT INTO public.schema_version (version) VALUES (186) ON CONFLICT DO NOTHING;
