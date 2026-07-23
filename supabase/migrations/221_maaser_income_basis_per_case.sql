-- =============================================================================
-- Migration 221: maaser_income_basis() — collected FEE minus commissions,
-- netted PER CASE. Office expenses leave the tithe calculation entirely.
-- =============================================================================
-- Fixes a real miscalculation from mig 220, which summed collections and office
-- expenses GLOBALLY and subtracted: SUM(collected) - SUM(expenses). On live data
-- only 7 cases have any collection while 63 have expenses logged, so the
-- expenses of not-yet-collected cases were subtracted from other cases'
-- collections, driving the base negative and zeroing the obligation.
--
-- The owner's rule, in his words:
--   * Office expenses are office expenses — neither income nor a deduction.
--     They must not appear in the tithe calculation at all. (Confirmed in the
--     collections domain: an expense becomes collectible the moment it is
--     entered, independent of execution — outstandingBalance = feeBalanceDue +
--     expenseBalance — so a payment reimbursing it is NOT fee income.)
--   * Only the agreed FEE, and only once actually collected, is tithable.
--   * Commissions paid to others out of that fee are not his profit, so they
--     come off — but only for cases where money was actually collected.
--
-- Per case, therefore:
--   fee        = MAX(collected - expenses, 0)   -- the fee part of what came in
--   commission = LEAST(payouts, fee)            -- deductible only up to the fee
--                                                  actually collected on THAT case
--   net        = fee - commission
--
-- LEAST(payouts, fee) is what makes "only cases where money was collected" fall
-- out for free: nothing collected -> fee = 0 -> commission deducted = 0. It also
-- handles partial collection (half the fee in -> at most half the commission
-- off) and can never drive the base negative. No case-status check needed; the
-- deduction simply follows the money.
--
-- Returns both figures so the UI can show the breakdown (fee collected, then
-- commissions off). Signature change from mig 220 requires DROP + CREATE.
--
-- Dependencies: 002 (is_admin), 206 (case_fee_payments), case_expenses,
-- case_payouts (186), 220.
-- =============================================================================

DROP FUNCTION IF EXISTS public.maaser_income_basis();

CREATE FUNCTION public.maaser_income_basis()
RETURNS TABLE (fee_collected NUMERIC, commissions NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(pc.fee), 0)::numeric,
    COALESCE(SUM(LEAST(pc.payouts, pc.fee)), 0)::numeric
  FROM (
    SELECT
      GREATEST(
        COALESCE((
          SELECT SUM(p.amount) FROM public.case_fee_payments p
           WHERE p.case_id = cs.id AND p.deleted_at IS NULL
        ), 0)
        - COALESCE((
          SELECT SUM(e.amount) FROM public.case_expenses e
           WHERE e.case_id = cs.id AND e.deleted_at IS NULL
        ), 0),
        0
      ) AS fee,
      COALESCE((
        SELECT SUM(o.amount) FROM public.case_payouts o
         WHERE o.case_id = cs.id AND o.deleted_at IS NULL
      ), 0) AS payouts
    FROM public.cases cs
  ) pc;
END;
$fn$;

REVOKE ALL ON FUNCTION public.maaser_income_basis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maaser_income_basis() TO authenticated;

COMMENT ON FUNCTION public.maaser_income_basis() IS
  'Manager-only ma''aser base. Per case: fee = MAX(collected - expenses, 0), '
  'commission = LEAST(payouts, fee). Returns the summed fee collected and the '
  'deductible commissions; net base = fee_collected - commissions. Office '
  'expenses never enter the tithe calculation. See migration 221.';

INSERT INTO public.schema_version (version) VALUES (221) ON CONFLICT DO NOTHING;
