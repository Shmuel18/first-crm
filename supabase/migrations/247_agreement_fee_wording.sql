-- 247 — the fee sentences become office-editable wording.
--
-- Migration 239 gave the office an editor for the agreement DOCUMENT
-- (office_settings.agreement_text). The fee clauses stayed in code, because
-- which sentence applies depends on the deal: a percentage or a flat sum, an
-- advance or none, an illustration or nothing to illustrate. The office could
-- move the {{placeholders}} around but not rewrite the sentences themselves.
--
-- This column stores the office's own text for each VARIANT, per language:
--   { "he": { "termsPercent": "...", "termsFixed": "...", ... }, "en": { ... } }
--
-- NULL, a missing key, or a sentence edited past usability falls back to the
-- approved default in domain/agreement-fee-text.ts — one sentence at a time, so
-- editing the advance clause never disturbs the rest. As with agreement_text,
-- every send snapshots what it printed onto its own case_agreements row, so
-- editing here can never rewrite an agreement a client already signed.

ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS agreement_fee_text JSONB;

COMMENT ON COLUMN public.office_settings.agreement_fee_text IS
  'Office-edited fee sentences per language and variant (termsPercent, '
  'termsFixed, loanChangePercent, loanChangeFixed, advanceWithAmount, '
  'advanceNone, estimate). NULL or a missing/unusable entry falls back to the '
  'default wording shipped in the app. Snapshotted per send like agreement_text.';

-- schema-version gate (migration 143): self-register this migration's number.
INSERT INTO public.schema_version (version) VALUES (247) ON CONFLICT DO NOTHING;
