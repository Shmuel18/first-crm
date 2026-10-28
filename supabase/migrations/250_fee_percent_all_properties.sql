-- 250 — a percentage fee is taken of the loans on ALL the case's properties.
--
-- Migration 248 derived a percentage fee from cases.requested_mortgage_amount,
-- which is only the FIRST property's loan. A case with a second property
-- (case_properties, migration 156) — e.g. 3,000,000 + 7,096,914 at 1% — was
-- charged 30,000 instead of 100,969. Reported by the office 2026-10-28.
--
-- The base is now case_total_requested_loan(case): the primary loan plus every
-- live (not soft-deleted) additional property's loan. NULL only when none of
-- them carries a figure, so a percentage fee still reads "no loan yet" then.
-- fee_amount stays the one number every consumer reads.

-- -----------------------------------------------------------------------------
-- 1. The base, in one place.
--    SECURITY DEFINER: the triggers below may run for a user whose RLS view of
--    case_properties is narrower than the case (and the derive trigger already
--    runs as definer for the same reason — see 248).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.case_total_requested_loan(p_case_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN c.requested_mortgage_amount IS NULL AND extra.total IS NULL THEN NULL
           ELSE coalesce(c.requested_mortgage_amount, 0) + coalesce(extra.total, 0)
         END
  FROM public.cases c
  LEFT JOIN LATERAL (
    SELECT sum(p.requested_mortgage_amount) AS total
    FROM public.case_properties p
    WHERE p.case_id = c.id
      AND p.deleted_at IS NULL
  ) extra ON TRUE
  WHERE c.id = p_case_id;
$$;

REVOKE ALL ON FUNCTION public.case_total_requested_loan(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.case_total_requested_loan(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Derive from the total (replaces 248's single-loan formula).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.case_financials_derive_percent_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fee_percent IS NOT NULL THEN
    NEW.fee_amount := round(public.case_total_requested_loan(NEW.case_id) * NEW.fee_percent / 100);
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Re-derive helper for a case — touching fee_percent fires the derive
--    trigger above, so the formula lives in exactly one place.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rederive_case_percent_fee(p_case_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.case_financials
     SET fee_percent = fee_percent
   WHERE case_id = p_case_id
     AND fee_percent IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.rederive_case_percent_fee(UUID) FROM PUBLIC;

-- The primary loan moved (248's trigger, now through the shared helper).
CREATE OR REPLACE FUNCTION public.cases_rederive_percent_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rederive_case_percent_fee(NEW.id);
  RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. An additional property's loan moved, or the property was added / removed
--    (removal is a soft delete — an UPDATE of deleted_at).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.case_properties_rederive_percent_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.rederive_case_percent_fee(OLD.case_id);
  ELSE
    PERFORM public.rederive_case_percent_fee(NEW.case_id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.case_properties_rederive_percent_fee() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_case_properties_rederive_percent_fee ON public.case_properties;
CREATE TRIGGER trg_case_properties_rederive_percent_fee
  AFTER INSERT OR DELETE OR UPDATE OF requested_mortgage_amount, deleted_at
  ON public.case_properties
  FOR EACH ROW
  EXECUTE FUNCTION public.case_properties_rederive_percent_fee();

-- -----------------------------------------------------------------------------
-- 5. Backfill: every existing percentage fee re-derives from the new base.
-- -----------------------------------------------------------------------------
UPDATE public.case_financials
   SET fee_percent = fee_percent
 WHERE fee_percent IS NOT NULL;

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (250) ON CONFLICT DO NOTHING;
