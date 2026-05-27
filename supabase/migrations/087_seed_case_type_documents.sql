-- =============================================================================
-- Migration 087: Seed default document requirements per case type
-- =============================================================================
-- case_type_documents (migration 008) defines which document_categories a case
-- needs and when (required_at_stage_id). The table was empty since 008 — the
-- checklist UI we just added on the /cases/[id]/documents page therefore
-- showed nothing.
--
-- This seed covers the 7 case_types from migration 004 + 079 with the common
-- Israeli mortgage doc set. Admin can refine via SQL/Studio (a /settings
-- requirements editor is a phase-2 follow-up).
--
-- Pattern:
--   * Identity + income docs (id_card, payslip, form_106, bank_statement, tax_assessment)
--     are required for EVERY case type by stage `document_collection`.
--   * Property docs (purchase_contract, appraisal, property_deed) attach to the
--     purchase types (contractor, second_hand, any_purpose w/ collateral).
--   * Refinance + transfer get property_deed only (no new purchase contract).
--   * Insurance docs (life_insurance_quote, property_insurance) for every type
--     by stage `ready_for_submission`, marked recommended (is_required=FALSE)
--     so missing ones surface as "אופציונלי" but don't block the checklist's
--     "all required collected" state.
--
-- ON CONFLICT keeps the seed idempotent — re-running merges new rows without
-- overwriting admin tweaks (the existing row wins).
-- =============================================================================

INSERT INTO public.case_type_documents (case_type_id, document_category_id, is_required, required_at_stage_id, sort_order)
SELECT
  ct.id, dc.id, vals.is_required, cs.id, vals.sort_order
FROM (VALUES
  -- Universal — every case type
  ('contractor',     'id_card',              TRUE,  'document_collection',   1),
  ('contractor',     'payslip',              TRUE,  'document_collection',  10),
  ('contractor',     'form_106',             TRUE,  'document_collection',  11),
  ('contractor',     'bank_statement',       TRUE,  'document_collection',  14),
  ('contractor',     'tax_assessment',       TRUE,  'document_collection',  13),
  ('contractor',     'purchase_contract',    TRUE,  'document_collection',  30),
  ('contractor',     'appraisal',            TRUE,  'ready_for_submission', 31),
  ('contractor',     'property_deed',        TRUE,  'ready_for_submission', 32),
  ('contractor',     'life_insurance_quote', FALSE, 'ready_for_submission', 40),
  ('contractor',     'property_insurance',   FALSE, 'ready_for_submission', 41),

  ('second_hand',    'id_card',              TRUE,  'document_collection',   1),
  ('second_hand',    'payslip',              TRUE,  'document_collection',  10),
  ('second_hand',    'form_106',             TRUE,  'document_collection',  11),
  ('second_hand',    'bank_statement',       TRUE,  'document_collection',  14),
  ('second_hand',    'tax_assessment',       TRUE,  'document_collection',  13),
  ('second_hand',    'purchase_contract',    TRUE,  'document_collection',  30),
  ('second_hand',    'appraisal',            TRUE,  'ready_for_submission', 31),
  ('second_hand',    'property_deed',        TRUE,  'ready_for_submission', 32),
  ('second_hand',    'life_insurance_quote', FALSE, 'ready_for_submission', 40),
  ('second_hand',    'property_insurance',   FALSE, 'ready_for_submission', 41),

  -- Refinance — keeping property, no new purchase contract
  ('refinance',      'id_card',              TRUE,  'document_collection',   1),
  ('refinance',      'payslip',              TRUE,  'document_collection',  10),
  ('refinance',      'form_106',             TRUE,  'document_collection',  11),
  ('refinance',      'bank_statement',       TRUE,  'document_collection',  14),
  ('refinance',      'tax_assessment',       TRUE,  'document_collection',  13),
  ('refinance',      'property_deed',        TRUE,  'document_collection',  30),
  ('refinance',      'appraisal',            TRUE,  'ready_for_submission', 31),
  ('refinance',      'life_insurance_quote', FALSE, 'ready_for_submission', 40),
  ('refinance',      'property_insurance',   FALSE, 'ready_for_submission', 41),

  -- Transfer between banks — paperwork-only, no new purchase
  ('transfer',       'id_card',              TRUE,  'document_collection',   1),
  ('transfer',       'payslip',              TRUE,  'document_collection',  10),
  ('transfer',       'bank_statement',       TRUE,  'document_collection',  14),
  ('transfer',       'tax_assessment',       TRUE,  'document_collection',  13),
  ('transfer',       'property_deed',        TRUE,  'document_collection',  30),
  ('transfer',       'life_insurance_quote', FALSE, 'ready_for_submission', 40),

  -- Any-purpose loan (uses property as collateral)
  ('any_purpose',    'id_card',              TRUE,  'document_collection',   1),
  ('any_purpose',    'payslip',              TRUE,  'document_collection',  10),
  ('any_purpose',    'bank_statement',       TRUE,  'document_collection',  14),
  ('any_purpose',    'tax_assessment',       TRUE,  'document_collection',  13),
  ('any_purpose',    'property_deed',        TRUE,  'document_collection',  30),
  ('any_purpose',    'appraisal',            TRUE,  'ready_for_submission', 31),
  ('any_purpose',    'life_insurance_quote', FALSE, 'ready_for_submission', 40),

  -- Renovation — property serves as collateral, no purchase contract
  ('renovation',     'id_card',              TRUE,  'document_collection',   1),
  ('renovation',     'payslip',              TRUE,  'document_collection',  10),
  ('renovation',     'bank_statement',       TRUE,  'document_collection',  14),
  ('renovation',     'property_deed',        TRUE,  'document_collection',  30),
  ('renovation',     'appraisal',            TRUE,  'ready_for_submission', 31),

  -- "Other" — minimal baseline; admin should refine via Studio
  ('other',          'id_card',              TRUE,  'document_collection',   1),
  ('other',          'payslip',              TRUE,  'document_collection',  10),
  ('other',          'bank_statement',       TRUE,  'document_collection',  14)
) AS vals(case_type_key, category_key, is_required, stage_key, sort_order)
JOIN public.case_types ct ON ct.key = vals.case_type_key
JOIN public.document_categories dc ON dc.key = vals.category_key
LEFT JOIN public.case_statuses cs ON cs.key = vals.stage_key
ON CONFLICT (case_type_id, document_category_id) DO NOTHING;
