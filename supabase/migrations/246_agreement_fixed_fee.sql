-- 246 — engagement agreements: allow a FIXED fee, not only a percentage.
--
-- Migration 239 made the percentage the authoritative commercial term and
-- turned fee_total into an informational estimate. That blocked a real
-- arrangement the office uses: a flat sum agreed up front, independent of the
-- loan (small refinances, partial support). Sending one had to be faked with
-- an invented percentage, which printed a false term in a signed contract.
--
-- The shape after this migration:
--   percentage deal → fee_percent set, fee_total = the printed ESTIMATE
--   fixed-fee deal  → fee_percent NULL, fee_total = the AGREED SUM
--
-- No column changes are needed (both are already nullable); what was missing
-- is the guarantee that a generated agreement states its price at all.

ALTER TABLE public.case_agreements
  DROP CONSTRAINT IF EXISTS case_agreements_fee_terms_present;

-- A GENERATED agreement must state its price one way or the other. The plain
-- "signed on paper" mark (signed_method='manual', migration 238) is exempt on
-- purpose: nothing was generated for it, so it carries no percentage, no total
-- and no advance — inventing figures there would put numbers on a record no
-- document backs. Prod already held such a row, which is what caught this.
ALTER TABLE public.case_agreements
  ADD CONSTRAINT case_agreements_fee_terms_present
  CHECK (
    signed_method = 'manual'
    OR fee_percent IS NOT NULL
    OR fee_total IS NOT NULL
  );

COMMENT ON COLUMN public.case_agreements.fee_percent IS
  'Agreed rate on a percentage engagement, applied to the loan actually '
  'advanced. NULL on a fixed-fee engagement, where fee_total is the agreed sum.';

COMMENT ON COLUMN public.case_agreements.fee_total IS
  'Percentage deal: INFORMATIONAL estimate (loan_amount x fee_percent) as '
  'printed for the client. Fixed-fee deal (fee_percent IS NULL): the AGREED '
  'fee itself. Either way the signed wording in text_snapshot governs.';

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (246) ON CONFLICT DO NOTHING;
