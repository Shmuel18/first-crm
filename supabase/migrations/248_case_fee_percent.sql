-- 248 — the agreed fee (שכ״ט) can be a PERCENTAGE of the mortgage, not only a sum.
--
-- The office prices most cases as a percentage of the loan. Until now the
-- מנהלה fee field took shekels only, so the advisor had to work the sum out by
-- hand and re-do it whenever the requested loan moved.
--
-- The shape after this migration:
--   fixed sum  → fee_percent NULL,  fee_amount = the agreed sum (as before)
--   percentage → fee_percent set,   fee_amount = round(requested loan × % / 100),
--                                   NULL while the case has no loan figure
--
-- fee_amount stays the ONE number every consumer reads — collections
-- (feeBalanceDue, collections_overview), /statistics, the case briefing — so
-- none of them change. It is kept in sync here, in the database, rather than in
-- the app, because the loan can change from several places (property block,
-- edit form, AI actions) and a percentage fee must follow every one of them.
--
-- Base = cases.requested_mortgage_amount: the same figure the engagement
-- agreement estimates from (migration 239), and the only loan amount the case
-- carries.

ALTER TABLE public.case_financials
  ADD COLUMN IF NOT EXISTS fee_percent NUMERIC
    CONSTRAINT case_financials_fee_percent_range
    CHECK (fee_percent IS NULL OR (fee_percent > 0 AND fee_percent <= 100));

COMMENT ON COLUMN public.case_financials.fee_percent IS
  'Agreed fee as a percentage of cases.requested_mortgage_amount. When set, '
  'fee_amount is DERIVED from it by trigger (migration 248) and any value '
  'written to fee_amount directly is overwritten. NULL = fixed-sum fee.';

-- -----------------------------------------------------------------------------
-- 1. A percentage row always carries the derived sum.
--    BEFORE INSERT/UPDATE, so every write path — the new RPC below, the old
--    upsert_case_financials, the collections advance actions — lands a
--    consistent row. A percentage wins over a sum written alongside it: the
--    only way to turn a percentage fee into a fixed one is to clear the
--    percentage (set_case_fee_terms does exactly that).
--    SECURITY DEFINER: it reads the loan off cases, and the writer may be the
--    loan trigger below acting for a user who cannot see case_financials.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.case_financials_derive_percent_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fee_percent IS NOT NULL THEN
    NEW.fee_amount := (
      SELECT round(c.requested_mortgage_amount * NEW.fee_percent / 100)
      FROM public.cases c
      WHERE c.id = NEW.case_id
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.case_financials_derive_percent_fee() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_case_financials_derive_percent_fee ON public.case_financials;
CREATE TRIGGER trg_case_financials_derive_percent_fee
  BEFORE INSERT OR UPDATE ON public.case_financials
  FOR EACH ROW
  EXECUTE FUNCTION public.case_financials_derive_percent_fee();

-- -----------------------------------------------------------------------------
-- 2. The requested loan moved → re-derive a percentage fee.
--    SECURITY DEFINER because the person editing the loan is usually an
--    advisor WITHOUT view_case_fee: under their own rights the RLS on
--    case_financials would filter the UPDATE to zero rows and the fee would
--    silently go stale. The function touches only the derived column of the
--    same case's row. The audit trigger (054) still records the change.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cases_rederive_percent_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The value is recomputed by trg_case_financials_derive_percent_fee; it is
  -- spelled out here too so the statement reads as what it does.
  UPDATE public.case_financials
     SET fee_amount = round(NEW.requested_mortgage_amount * fee_percent / 100)
   WHERE case_id = NEW.id
     AND fee_percent IS NOT NULL;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.cases_rederive_percent_fee() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_cases_rederive_percent_fee ON public.cases;
CREATE TRIGGER trg_cases_rederive_percent_fee
  AFTER UPDATE OF requested_mortgage_amount ON public.cases
  FOR EACH ROW
  WHEN (OLD.requested_mortgage_amount IS DISTINCT FROM NEW.requested_mortgage_amount)
  EXECUTE FUNCTION public.cases_rederive_percent_fee();

-- -----------------------------------------------------------------------------
-- 3. set_case_fee_terms — the מנהלה fee field's write path.
--    Sets the fee as EITHER a sum or a percentage (both NULL clears it) and
--    returns the resulting fee_amount, so the UI shows the derived sum without
--    a second round trip. Same guards as upsert_case_financials (migration
--    200). Unlike that RPC it leaves expected_income / advance columns alone,
--    so the caller doesn't have to read-then-write them back.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_case_fee_terms(
  p_case_id UUID,
  p_fee_amount NUMERIC,
  p_fee_percent NUMERIC,
  p_user_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'set_case_fee_terms: actor mismatch' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission('view_case_fee') OR NOT public.can_edit_case(p_case_id) THEN
    RAISE EXCEPTION 'set_case_fee_terms: not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_fee_amount IS NOT NULL AND p_fee_percent IS NOT NULL THEN
    RAISE EXCEPTION 'set_case_fee_terms: a fee is a sum OR a percentage, not both'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.case_financials (case_id, fee_amount, fee_percent, created_by, updated_by)
  VALUES (p_case_id, p_fee_amount, p_fee_percent, p_user_id, p_user_id)
  ON CONFLICT (case_id) DO UPDATE SET
    fee_amount = EXCLUDED.fee_amount,
    fee_percent = EXCLUDED.fee_percent,
    updated_by = EXCLUDED.updated_by
  RETURNING fee_amount INTO v_fee;

  RETURN v_fee;
END;
$$;

REVOKE ALL ON FUNCTION public.set_case_fee_terms(UUID, NUMERIC, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_case_fee_terms(UUID, NUMERIC, NUMERIC, UUID) TO authenticated;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (248) ON CONFLICT DO NOTHING;
