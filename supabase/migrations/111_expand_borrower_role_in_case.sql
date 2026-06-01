-- =============================================================================
-- Migration 111: Expand case_borrowers.role_in_case (4 roles)
-- =============================================================================
-- The borrower role was borrower/guarantor (migration 007). Per Kaufman, add:
--   - rights_owner        (בעל זכויות)  - holds rights in the property
--   - mortgaging_borrower (לווה ממשכן)  - borrower who pledges the property
-- Single-select; the live borrower card + add-borrower form now offer all 4.
--
-- NOTE: create_case_draft_rpc (migrations 074/092) still validates the draft
-- new-case flow against ('borrower','guarantor') only. That path has no role
-- picker (it always submits the 'borrower' default), so the stricter check is
-- harmless there; roles are assigned/refined later on the live borrower card.
-- Left untouched here rather than rewrite the whole RPC body.
-- =============================================================================

ALTER TABLE public.case_borrowers
  DROP CONSTRAINT IF EXISTS case_borrowers_role_in_case_check;

ALTER TABLE public.case_borrowers
  ADD CONSTRAINT case_borrowers_role_in_case_check
  CHECK (role_in_case IN ('borrower', 'guarantor', 'rights_owner', 'mortgaging_borrower'));

COMMENT ON COLUMN public.case_borrowers.role_in_case IS 'Role on the case: borrower / guarantor / rights_owner / mortgaging_borrower';
