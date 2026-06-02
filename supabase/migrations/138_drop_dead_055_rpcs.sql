-- =============================================================================
-- Migration 138: drop the dead / stale migration-055 RPCs (footgun cleanup)
-- =============================================================================
-- Two functions from migration 055 are no longer used and are actively
-- dangerous if ever called again:
--
--   * create_case_with_financials — STALE. It lists only a handful of the
--     `cases` columns the new-case form actually writes, so calling it would
--     silently DROP the rest (case types, property value, equity, etc.). The
--     create flow never adopted it (DB-3 / migration 119 used a compensating
--     cleanup instead). Zero callers in app code or the DB.
--
--   * save_borrower_for_case (the 9-arg 055/064 version) — superseded by
--     save_borrower_for_case_full (065/123) + update_borrower_in_case, which
--     the app uses. The bare version has no app or DB caller.
--
-- Verified before drop: no `.rpc(...)` callsite in src/, and no migration /
-- trigger / RPC references either name (only definitions + comments). Dropping
-- them removes the landmine so a future accidental call can't silently corrupt
-- data. The LIVE functions (save_borrower_for_case_full, update_borrower_in_case,
-- create_case_draft) are untouched.
-- =============================================================================

DROP FUNCTION IF EXISTS public.create_case_with_financials(
  UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC
);

DROP FUNCTION IF EXISTS public.save_borrower_for_case(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN
);
