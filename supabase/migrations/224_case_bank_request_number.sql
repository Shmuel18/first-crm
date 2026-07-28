-- =============================================================================
-- Migration 224: cases.bank_request_number — the bank's application number
-- =============================================================================
-- Kaufman: lately the bank application number matters a lot, especially for
-- foreign residents — the application is opened in a dedicated call center and
-- then moves to a branch, where finding it by passport number is painful. He
-- barely uses "גורם מעכב" (case_blocker), so in the admin block the blocker
-- field is REPLACED by this one.
--
-- case_blocker stays in the DB untouched (dormant, like expected_income —
-- see that precedent): existing values and audit history keep rendering; the
-- UI simply no longer offers it.
--
-- Free text (not numeric): bank reference formats vary and may carry
-- letters/dashes. Length is enforced at the app layer (same NAME_MAX bound as
-- the other short strings on cases). No index — it is searched via the
-- in-memory dashboard search over the already-loaded set, not by SQL.
--
-- Idempotent. Deps: 006 (cases).
-- =============================================================================

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS bank_request_number TEXT;

COMMENT ON COLUMN public.cases.bank_request_number IS
  'The bank''s application/request number (מספר בקשה). Replaced case_blocker '
  'in the admin-block UI (migration 224); case_blocker is dormant, not dropped.';

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (224) ON CONFLICT DO NOTHING;
